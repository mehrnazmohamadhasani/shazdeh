import { z } from "zod";
import { PAYMENT_MODES, SPEND_CATEGORIES, STOCK_UNITS } from "./extraction";
import { packSchema } from "./pack";

/*
 * What the review screen sends when a person confirms a reading. Shared
 * by the form (client) and the save endpoint (server). Amounts in AED.
 */

const money = z.number().finite();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const saveLineSchema = z.object({
  rawName: z.string().trim().min(1).max(300),
  itemCode: z.string().trim().max(100).nullable(),
  quantity: z.number().positive(),
  unit: z.string().trim().max(30).nullable(),
  unitPrice: money.nullable(),
  discount: money.default(0),
  vat: money.nullable().default(null),
  lineTotal: money,
  category: z.enum(SPEND_CATEGORIES),
  /** Existing ingredient (id) or a new one (name + unit). Null = not stock. */
  ingredient: z
    .object({
      id: z.string().nullable(),
      name: z.string().trim().min(1).max(120),
      unit: z.enum(STOCK_UNITS),
      /** The kind of meat this raw meat is (lamb, beef…), set on the ingredient. Left out: unchanged; null: not meat. */
      meatTypeId: z.string().min(1).nullable().optional(),
    })
    .nullable(),
  /** Stock this line adds, in the ingredient's unit. */
  stockQuantity: z.number().positive().nullable(),
  /** How one unit is packed, as confirmed; remembered for this supplier's item. */
  pack: packSchema.nullable().default(null),
});

export const saveInvoiceSchema = z.object({
  supplier: z.object({
    id: z.string().nullable(),
    name: z.string().trim().min(1).max(200),
    trn: z.string().trim().max(30).nullable(),
    phone: z.string().trim().max(40).nullable().default(null),
  }),
  invoiceNo: z.string().trim().max(60).nullable(),
  invoiceDate: day,
  paymentMode: z.enum(PAYMENT_MODES).nullable(),
  /** Credit invoices; defaults to the supplier's payment terms. */
  dueDate: day.nullable().default(null),
  /** Cash/card: who paid ("Owner", a staff name…). */
  paidBy: z.string().trim().max(80).nullable().default(null),
  notes: z.string().trim().max(1000).nullable().default(null),
  pricesIncludeVat: z.boolean(),
  subtotal: money.nullable(),
  discount: money,
  vat: money.nullable(),
  total: money,
  lines: z.array(saveLineSchema).max(200),
});

export type SaveInvoiceInput = z.infer<typeof saveInvoiceSchema>;
export type SaveLineInput = z.infer<typeof saveLineSchema>;
