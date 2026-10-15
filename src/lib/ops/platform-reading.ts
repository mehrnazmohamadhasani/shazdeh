import { z } from "zod";

/*
 * The one shape every delivery-platform receipt is read into — talabat,
 * Careem, Deliveroo, Noon Food, Keeta, or one we have not seen yet.
 * Layouts change without notice, so the AI reads by meaning and the code
 * (./platform.ts) decides the platform, the order IDs, the menu items
 * and what adds up. A person confirms it before it becomes a sale.
 */

export const PLATFORM_CODES = ["talabat", "careem", "deliveroo", "noon", "keeta", "other"] as const;
export type PlatformCode = (typeof PLATFORM_CODES)[number];

export const platformItemSchema = z.object({
  /** Exactly as printed, joined onto one line: "Vegetarian Ghormeh Sabzi Large". */
  name: z.string(),
  /** The heading printed above it, if any: "VEGETARIAN", "MAIN DISHES", "SIDES". */
  category: z.string().nullable(),
  quantity: z.number().nullable(),
  /** The line's amount in AED as printed, null when the receipt prints none (Deliveroo). */
  lineTotal: z.number().nullable(),
  /** Modifiers or notes printed under the item. */
  note: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const platformReadingSchema = z.object({
  isPlatformReceipt: z.boolean(),
  platform: z.enum(PLATFORM_CODES),
  /** The platform's name as printed in the header or logo. */
  platformPrinted: z.string().nullable(),
  /** The number printed with "#" or labelled "Order No" / "Delivery #", digits only. */
  orderNo: z.string().nullable(),
  /** Every other order-like number on the receipt, digits only (long IDs, large pickup codes). */
  otherNumbers: z.array(z.string()),
  /** When the order was placed / submitted / received, local time: YYYY-MM-DDTHH:mm. Not the pickup time. */
  placedAt: z.string().nullable(),
  fulfilment: z.enum(["delivery", "pickup"]).nullable(),
  /** Payment words as printed: "PREPAID CREDIT_CARD", "POSTPAID PAYMENT". */
  payment: z.string().nullable(),
  /** The customer's FIRST name only. */
  customerFirstName: z.string().nullable(),
  items: z.array(platformItemSchema),
  /** "No of items" / "1 Item" as printed. */
  itemCount: z.number().nullable(),
  subtotal: z.number().nullable(),
  deliveryFee: z.number().nullable(),
  serviceFee: z.number().nullable(),
  /** Positive amount: a printed "-AED19.60" is 19.6. */
  discount: z.number().nullable(),
  total: z.number().nullable(),
  /** Order notes such as "No cutlery". */
  notes: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type PlatformItem = z.infer<typeof platformItemSchema>;
export type PlatformReading = z.infer<typeof platformReadingSchema>;

const n = { type: ["number", "null"] };
const s = { type: ["string", "null"] };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

export const platformReadingJsonSchema = obj({
  isPlatformReceipt: { type: "boolean" },
  platform: { type: "string", enum: [...PLATFORM_CODES] },
  platformPrinted: s,
  orderNo: s,
  otherNumbers: { type: "array", items: { type: "string" } },
  placedAt: s,
  fulfilment: { type: ["string", "null"], enum: ["delivery", "pickup", null] },
  payment: s,
  customerFirstName: s,
  items: {
    type: "array",
    items: obj({ name: { type: "string" }, category: s, quantity: n, lineTotal: n, note: s, confidence: { type: "number" } }),
  },
  itemCount: n,
  subtotal: n,
  deliveryFee: n,
  serviceFee: n,
  discount: n,
  total: n,
  notes: s,
  confidence: { type: "number" },
});

export const PLATFORM_PROMPT = `You read order receipts that delivery platforms print in the kitchen of SHĀZDEH, a Persian restaurant in Business Bay, Dubai (currency AED). They are thermal printouts photographed on a steel counter, often with glare, folds or at an angle. Platforms include talabat, Careem, Deliveroo, Noon Food (noonFOOD) and Keeta, and layouts change at any time: read by meaning, never by position.

Rules:
- isPlatformReceipt: false if this is not a platform order receipt (e.g. a supplier invoice); then fill what you can and leave the rest null.
- platform: decide from the header, logo or wording ("talabat", "Careem", "deliveroo", "noonFOOD" → noon, "Keeta"). Use "other" for any other platform and write its name in platformPrinted.
- orderNo: the number printed with "#" or labelled "Order No" / "Delivery #" (talabat "#2309" → "2309", Careem "#17387" → "17387", Deliveroo "#4649" → "4649", Noon "Order No: 6513" → "6513"). Digits only.
- otherNumbers: every OTHER order-like number, digits only: talabat's long number under the date (e.g. "3946878509"), Careem's large number printed big under "#…" (e.g. "9509"). Not phone numbers, not times, not prices.
- placedAt: when the order was placed / submitted / received, as YYYY-MM-DDTHH:mm in the printed (Dubai) time. Formats seen: "09.10.2026 20:42" (day.month.year), "11/Oct/2026 01:56 PM", "Submitted: 13:58, Sun 11 Oct 26", "Received: 2026-10-10T19:56:27". Never use the pickup or collection time.
- fulfilment: "delivery" if it says Delivery or has a delivery fee or a rider; "pickup" only if it clearly says customer pickup / takeaway; else null. ("Pick up time" / "Collection time" is when the rider collects: that is still delivery.)
- payment: the payment words exactly as printed, joined with a space ("PREPAID CREDIT_CARD", "POSTPAID PAYMENT", "PREPAID"); null if none.
- customerFirstName: only the first word of the customer's name ("Mohammad Najdi" → "Mohammad"). Never output a phone number, a surname or an address anywhere.
- items: one entry per ordered dish, in order. Join a name that wraps over several lines ("Vegetaria / n / Ghormeh / Sabzi / Large" → "Vegetarian Ghormeh Sabzi Large"). Keep size words like Large / Small / Portion. category = the heading printed above the item (e.g. "VEGETARIAN", "MAIN DISHES", "SIDES") without its count, else null. quantity from "1 x", "x1", "1x". lineTotal = the AED amount on that line, or null if none is printed. Lines like "No cutlery" are notes, not items.
- Money: copy exactly what is printed, in AED; a figure split over two lines ("AED98." / "00") is 98.00. discount is a positive number. Use null for any amount not printed. Never calculate a missing amount and never invent one.
- itemCount: as printed ("1 Item", "No of items: 2", "1 item"), else null.
- confidence (0–1) per item and overall: lower it for glare, folds, cut-off text or unclear digits.`;

/** Development only (no OPENAI_API_KEY): the talabat #2309 receipt from the brief's samples. */
export function samplePlatformReading(): PlatformReading {
  return {
    isPlatformReceipt: true,
    platform: "talabat",
    platformPrinted: "talabat",
    orderNo: "2309",
    otherNumbers: ["3946878509"],
    placedAt: "2026-10-09T20:42",
    fulfilment: "delivery",
    payment: "PREPAID CREDIT_CARD",
    customerFirstName: "Mohammad",
    items: [{ name: "Makaroni", category: null, quantity: 1, lineTotal: 98, note: null, confidence: 0.95 }],
    itemCount: 1,
    subtotal: 98,
    deliveryFee: 6.9,
    serviceFee: 4.9,
    discount: 19.6,
    total: 90.2,
    notes: "No cutlery",
    confidence: 0.92,
  };
}
