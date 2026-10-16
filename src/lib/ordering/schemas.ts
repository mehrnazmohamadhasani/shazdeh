import { z } from "zod";
import { MAX_LINES, MAX_QUANTITY_PER_LINE } from "@/lib/ordering/pricing";
import { normalizeMobile } from "@/lib/ordering/phone";

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
        const e164 = normalizeMobile(v);
        if (!e164) {
          ctx.addIssue({ code: "custom", message: "Enter a mobile number. Include the country code if it isn't a UAE number, e.g. +44 7911 123456" });
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
  /** "whatsapp" when the customer came from the link sent on WhatsApp (?src=whatsapp). */
  source: z.enum(["website", "whatsapp"]).optional(),
});

/**
 * An order a staff member enters for a customer who messaged on WhatsApp
 * or called. Same lines, address and customer as the website (prices are
 * still worked out on the server); pay on delivery only.
 */
export const staffOrderSchema = placeOrderSchema
  .omit({ paymentMethod: true, source: true })
  .extend({
    source: z.enum(["WHATSAPP", "PHONE"]),
    paymentMethod: z.enum(["CASH_ON_DELIVERY", "CARD_ON_DELIVERY"]),
  });

/** Tracking tokens this device remembers, for the "your orders" list. */
export const trackStatusesSchema = z.object({
  tokens: z.array(z.string().regex(/^[A-Za-z0-9_-]{16,64}$/)).min(1).max(10),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type StaffOrderInput = z.infer<typeof staffOrderSchema>;
