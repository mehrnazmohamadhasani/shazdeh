import { z } from "zod";

/** A platform sale as confirmed on the review screen. Money in AED as typed. */
const aed = z.number().min(0).max(100_000);

export const savePlatformOrderSchema = z.object({
  channelCode: z.string().trim().min(1).max(40),
  orderNo: z.string().trim().min(1).max(40),
  altOrderId: z.string().trim().max(40).nullable(),
  /** Dubai local time, YYYY-MM-DDTHH:mm */
  placedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  fulfilment: z.enum(["delivery", "pickup"]).nullable(),
  payment: z.string().trim().max(80).nullable(),
  customerFirstName: z.string().trim().max(40).nullable(),
  items: z
    .array(
      z.object({
        rawName: z.string().trim().min(1).max(200),
        category: z.string().trim().max(80).nullable(),
        quantity: z.number().int().min(1).max(500),
        lineTotal: aed.nullable(),
        menuItemId: z.string().nullable(),
      }),
    )
    .min(1)
    .max(100),
  subtotal: aed.nullable(),
  deliveryFee: aed.nullable(),
  serviceFee: aed.nullable(),
  discount: aed,
  discountFundedBy: z.enum(["UNKNOWN", "RESTAURANT", "PLATFORM", "SHARED"]),
  total: aed,
  note: z.string().trim().max(500).nullable(),
});

export type SavePlatformOrderInput = z.infer<typeof savePlatformOrderSchema>;
