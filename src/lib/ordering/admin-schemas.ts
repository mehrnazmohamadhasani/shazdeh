import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/ordering/status";

/* Admin-side schemas for ordering: settings, zones, coupons, modifiers, orders. */

const money = z.number().min(0).max(100000);
const text = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const hoursJson = z
  .string()
  .max(2000)
  .nullable()
  .optional()
  .refine((v) => {
    if (!v) return true;
    try {
      const o = JSON.parse(v) as unknown;
      return !!o && typeof o === "object" && !Array.isArray(o) && Object.values(o).every((x) => typeof x === "string");
    } catch {
      return false;
    }
  }, 'Hours must be JSON like {"mon":"12:00 — 23:00"}')
  .transform((v) => (v ? v : null));

export const orderingSettingsSchema = z.object({
  acceptingOrders: z.boolean().optional(),
  pausedMessage: nullableText(200),
  deliveryHours: hoursJson,
  kitchenLat: z.number().min(22).max(27).nullable().optional(),
  kitchenLng: z.number().min(51).max(57).nullable().optional(),
  vatRate: z.number().min(0).max(30).optional(),
  pricesIncludeVat: z.boolean().optional(),
  serviceFee: money.optional(),
  paymentMethods: z.array(z.enum(["CASH_ON_DELIVERY", "CARD_ON_DELIVERY", "ONLINE"])).max(3).optional(),
  deliveryModel: z.enum(["OWN_FLEET", "THIRD_PARTY", "HYBRID"]).optional(),
  autoAccept: z.boolean().optional(),
  notifyEmail: z.email().nullable().optional().or(z.literal("").transform(() => null)),
  legalName: nullableText(160),
  tradeLicenseNo: nullableText(60),
  licensingAuthority: nullableText(120),
  trn: nullableText(30),
});

/** What kitchen staff may change: the busy switch only. */
export const acceptingSchema = z.object({
  acceptingOrders: z.boolean(),
  pausedMessage: nullableText(200),
});

export const areaInputSchema = z.object({
  name: text(80).min(1),
  lat: z.number().min(22).max(27).nullable().optional(),
  lng: z.number().min(51).max(57).nullable().optional(),
});

export const zoneSchema = z
  .object({
    name: text(80).min(1),
    fee: money,
    minOrder: money,
    freeDeliveryOver: money.nullable().optional(),
    etaMin: z.number().int().min(5).max(240),
    etaMax: z.number().int().min(5).max(300),
    // 0 or empty = no distance limit.
    radiusKm: z
      .number()
      .min(0)
      .max(80)
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    isActive: z.boolean().optional().default(true),
    order: z.number().int().min(0).optional().default(0),
    areas: z.array(areaInputSchema).max(200),
  })
  .refine((z) => z.etaMax >= z.etaMin, { message: "Latest time must be after earliest time", path: ["etaMax"] });

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/, "Letters, numbers, - and _ only"),
  description: nullableText(200),
  type: z.enum(["PERCENT", "FIXED", "FREE_DELIVERY"]),
  value: z.number().min(0).max(100000),
  minSubtotal: money.optional().default(0),
  maxDiscount: money.nullable().optional(),
  startsAt: z.iso.datetime().nullable().optional(),
  endsAt: z.iso.datetime().nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  perPhoneLimit: z.number().int().min(1).nullable().optional(),
  isActive: z.boolean().optional().default(true),
}).refine((c) => c.type !== "PERCENT" || c.value <= 100, { message: "A percentage can't exceed 100", path: ["value"] });

export const modifiersSchema = z.object({
  groups: z
    .array(
      z
        .object({
          id: z.string().optional(),
          name: text(60).min(1),
          minSelect: z.number().int().min(0).max(20),
          maxSelect: z.number().int().min(1).max(20),
          options: z
            .array(
              z.object({
                id: z.string().optional(),
                name: text(80).min(1),
                price: z.number().min(0).max(10000),
                isAvailable: z.boolean().default(true),
              }),
            )
            .min(1, "Each group needs at least one option")
            .max(30),
        })
        .refine((g) => g.maxSelect >= g.minSelect, { message: "Max must be at least min", path: ["maxSelect"] })
        .refine((g) => g.minSelect <= g.options.length, { message: "Min is more than the number of options", path: ["minSelect"] }),
    )
    .max(10),
});

export const orderActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    to: z.enum(ORDER_STATUSES),
    reason: nullableText(300),
    dispatch: z
      .object({
        provider: z.string().max(40),
        driverName: nullableText(80),
        driverPhone: nullableText(40),
        deliveryRef: nullableText(120),
        trackingUrl: z
          .string()
          .trim()
          .max(500)
          .refine((v) => v === "" || /^https:\/\//i.test(v), "Tracking link must start with https://")
          .nullable()
          .optional()
          .transform((v) => (v ? v : null)),
      })
      .optional(),
  }),
  z.object({ action: z.literal("note"), message: text(500).min(1) }),
  z.object({ action: z.literal("delay"), minutes: z.number().int().min(5).max(120) }),
  z.object({ action: z.literal("markPaid") }),
  z.object({ action: z.literal("ack") }),
  z.object({ action: z.literal("claimPrint") }),
  z.object({
    action: z.literal("reduceItem"),
    itemId: z.string().min(1).max(40),
    // 0 removes the dish from the order.
    quantity: z.number().int().min(0).max(30),
    markSoldOut: z.boolean().default(true),
  }),
]);

/** A browser PushSubscription.toJSON(). */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000).refine((v) => v.startsWith("https://"), "Push endpoint must be https"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const teamMemberSchema = z.object({
  email: z.email().max(160),
  name: nullableText(80),
  role: z.enum(["ADMIN", "EDITOR", "STAFF"]),
  password: z.string().min(10, "Use at least 10 characters").max(200),
});

export const teamUpdateSchema = z.object({
  name: nullableText(80),
  role: z.enum(["ADMIN", "EDITOR", "STAFF"]).optional(),
  password: z.string().min(10, "Use at least 10 characters").max(200).optional(),
});
