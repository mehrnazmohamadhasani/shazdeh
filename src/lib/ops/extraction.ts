import { z } from "zod";

/*
 * The one canonical shape every supplier invoice, receipt or
 * handwritten bill is read into — whatever its layout or language. The
 * AI fills it (src/lib/ops/ai.ts); code then checks the arithmetic
 * (./checks.ts) and works out stock quantities (./units.ts). Amounts
 * are AED exactly as printed; they become fils only when saved.
 */

export const SPEND_CATEGORIES = ["food", "packaging", "smallwares", "delivery", "other"] as const;
export const STOCK_UNITS = ["g", "ml", "pcs"] as const;
export const PAYMENT_MODES = ["cash", "card", "credit", "transfer"] as const;

const num = z.number().nullable();
const str = z.string().nullable();

export const extractedLineSchema = z.object({
  description: z.string(),
  itemCode: str,
  quantity: num,
  /** As printed: kg, Pcs, CTN, TIN… */
  unit: str,
  /** Pack size if printed or in the name: "4 x 10 kg", "800 g". */
  packSize: str,
  unitPrice: num,
  discount: num,
  vat: num,
  lineTotal: num,
  category: z.enum(SPEND_CATEGORIES),
  /** The AI's guess of how the kitchen counts it, and how much this line adds. */
  stockUnit: z.enum(STOCK_UNITS).nullable(),
  stockQuantity: num,
  confidence: z.number().min(0).max(1),
  note: str,
});

export const extractionSchema = z.object({
  documentType: z.enum(["supplier_invoice", "shop_receipt", "card_slip", "platform_order", "supplier_statement", "other"]),
  handwritten: z.boolean(),
  supplier: z.object({ name: str, trn: str, phone: str }),
  invoiceNumber: str,
  /** YYYY-MM-DD */
  invoiceDate: str,
  paymentMode: z.enum(PAYMENT_MODES).nullable(),
  currency: str,
  pricesIncludeVat: z.boolean().nullable(),
  lines: z.array(extractedLineSchema),
  subtotal: num,
  discount: num,
  vat: num,
  total: num,
  /** Short hints, e.g. handwritten notes on the paper ("باقلی" = fava beans). */
  notes: str,
  confidence: z.number().min(0).max(1),
});

export type ExtractedLine = z.infer<typeof extractedLineSchema>;
export type Extraction = z.infer<typeof extractionSchema>;

/*
 * JSON Schema for the model's structured output. Strict mode needs every
 * property listed in `required` and no extra properties, so nullable
 * fields are typed ["x", "null"].
 */
const n = { type: ["number", "null"] };
const s = { type: ["string", "null"] };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

export const extractionJsonSchema = obj({
  documentType: { type: "string", enum: ["supplier_invoice", "shop_receipt", "card_slip", "platform_order", "supplier_statement", "other"] },
  handwritten: { type: "boolean" },
  supplier: obj({ name: s, trn: s, phone: s }),
  invoiceNumber: s,
  invoiceDate: { ...s, description: "YYYY-MM-DD" },
  paymentMode: { type: ["string", "null"], enum: [...PAYMENT_MODES, null] },
  currency: s,
  pricesIncludeVat: { type: ["boolean", "null"] },
  lines: {
    type: "array",
    items: obj({
      description: { type: "string" },
      itemCode: s,
      quantity: n,
      unit: s,
      packSize: s,
      unitPrice: n,
      discount: n,
      vat: n,
      lineTotal: n,
      category: { type: "string", enum: [...SPEND_CATEGORIES] },
      stockUnit: { type: ["string", "null"], enum: [...STOCK_UNITS, null] },
      stockQuantity: n,
      confidence: { type: "number" },
      note: s,
    }),
  },
  subtotal: n,
  discount: n,
  vat: n,
  total: n,
  notes: s,
  confidence: { type: "number" },
});

export const EXTRACTION_PROMPT = `You read purchase documents for SHĀZDEH, a Persian restaurant / cloud kitchen in Dubai (currency AED, VAT 5%).
The image is a supplier invoice, a shop receipt, a card slip or a handwritten bill. It may be in English, Arabic or Persian, photographed at an angle, cropped, faded or with glare. Layouts differ for every supplier: read by meaning, never by position.

First decide what the document is. SHĀZDEH also prints receipts for its own customer orders from delivery platforms (Talabat, Careem, Noon Food, Deliveroo, Keeta): they show SHĀZDEH's name, a customer, dishes like "Ghormeh Sabzi" and fees. Those are SALES, not purchases: set documentType to "platform_order", supplier.name to the platform's name, and still read the lines and totals.

A supplier "statement of account" lists several of the supplier's invoices (number, date, amount) but no items: set documentType to "supplier_statement", supplier.name to the supplier, and add one line per listed invoice with description = the invoice number exactly as printed, itemCode = that invoice's date as YYYY-MM-DD, lineTotal = its amount, quantity = null and category "other". total is the statement total.

Rules:
- Copy what is printed. Never invent or "fix" a number. If a value is missing or unreadable, use null and explain in the line's note.
- One entry in "lines" per printed item line, in order. Delivery charges are their own line with category "delivery".
- quantity, unitPrice, discount, vat and lineTotal are the numbers on that line, in AED. vat is the VAT AMOUNT in AED (e.g. 4.25), never the rate (5%). Discounts are positive amounts (a printed "-16.00" discount is 16).
- packSize: the pack size if printed in a column or in the product name ("4 x 10 kg", "800G", "1000 ml"), else null.
- category: food = ingredients and drinks for cooking or resale; packaging = takeaway boxes, bags, foil, labels; smallwares = kitchen tools, equipment, cleaning; delivery = delivery/transport charges; other = anything else.
- stockUnit / stockQuantity: how the kitchen would count this line in stock — "g" for solids, "ml" for liquids, "pcs" for countable items — and the TOTAL amount the whole line adds (e.g. 5 cartons of 4 x 10 kg rice = 200000 g; 2 pcs of tomato paste 800 g = 1600 g; 15 kg lamb = 15000 g). If the pack size is truly unclear, set stockQuantity to null and say why in note. Use null for delivery and non-stock lines.
- confidence (0–1) per line and overall: how sure you are you read it correctly. Lower it for handwriting, blur, glare or ambiguous quantities (e.g. a "3B" that could be 38).
- invoiceDate as YYYY-MM-DD. Dates may be written 09/07/2026, 16-Jul-2026, 24-08-26 or 27/8/2026 (day first in the UAE).
- pricesIncludeVat: true if line prices already include VAT, false if VAT is added on top, null if you can't tell.
- supplier.trn is the 15-digit UAE Tax Registration Number if printed.
- If only a card slip is visible (no item lines), return an empty lines array with the total.
- notes: short hints such as handwritten words on the paper (translate Persian/Arabic words, e.g. «باقلی» = fava beans, «نون» = bread).`;
