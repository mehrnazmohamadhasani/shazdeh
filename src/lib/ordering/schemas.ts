import { z } from "zod";
import { MAX_LINES, MAX_QUANTITY_PER_LINE } from "@/lib/ordering/pricing";
import { normalizeUaeMobile } from "@/lib/ordering/phone";

/*
 * Request schemas for the public ordering API. Note what is absent:
 * no prices, fees, totals or discounts are accepted from the client.
 */

const id = z.string().trim().min(1).max(64);

export const cartLineSchema = z.object({
  itemId: id,
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
  optionIds: z.array(id).max(30).default([]),
  notes: z.string().trim().max(200).nullable().optional(),
});

const coords = {
  lat: z.number().min(22).max(27).nullable().optional(), // UAE bounding box
  lng: z.number().min(51).max(57).nullable().optional(),
};

export const quoteSchema = z.object({
  lines: z.array(cartLineSchema).min(1).max(MAX_LINES),
  areaId: id.nullable().optional(),
  couponCode: z.string().trim().max(32).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  ...coords,
});

export const addressSchema = z.object({
  areaId: id,
  addressType: z.enum(["apartment", "villa", "office"]),
  building: z.string().trim().min(1, "Building or villa is required").max(120),
  street: z.string().trim().max(160).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  floor: z.string().trim().max(20).nullable().optional(),
  instructions: z.string().trim().max(300).nullable().optional(),
  ...coords,
});

export const placeOrderSchema = z.object({
  idempotencyKey: z.string().trim().min(16).max(64),
  lines: z.array(cartLineSchema).min(1).max(MAX_LINES),
  address: addressSchema,
  customer: z.object({
    name: z.string().trim().min(2, "Please enter your name").max(80),
    phone: z
      .string()
      .trim()
      .max(32)
      .transform((v, ctx) => {
        const e164 = normalizeUaeMobile(v);
        if (!e164) {
          ctx.addIssue({ code: "custom", message: "Enter a UAE mobile number, e.g. 050 123 4567" });
          return z.NEVER;
        }
        return e164;
      }),
    email: z.email().max(160).nullable().optional().or(z.literal("").transform(() => null)),
    marketingOptIn: z.boolean().optional().default(false),
  }),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "CARD_ON_DELIVERY", "ONLINE"]),
  couponCode: z.string().trim().max(32).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  cutlery: z.boolean().optional().default(false),
  /** What the customer saw. If the server's total differs, we stop and re-confirm. */
  expectedTotalFils: z.number().int().nonnegative(),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
