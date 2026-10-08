import "server-only";
import { prisma } from "@/lib/prisma";
import { toFils } from "@/lib/ordering/money";
import type { CouponTerms } from "@/lib/ordering/pricing";

export type CouponLookup =
  | { ok: true; id: string; usageLimit: number | null; terms: CouponTerms }
  | { ok: false; message: string };

/**
 * Validates a code for this customer right now. Usage is only consumed
 * when the order is placed (atomically, inside the order transaction).
 * Note: phones are not verified yet, so per-phone limits deter casual
 * reuse but are not proof against a determined abuser — add OTP before
 * running generous first-order offers.
 */
export async function lookupCoupon(
  rawCode: string,
  phone: string | null,
  now = new Date(),
): Promise<CouponLookup> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, message: "Enter a promo code." };
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  const invalid = { ok: false as const, message: "That promo code isn't valid." };
  if (!coupon || !coupon.isActive) return invalid;
  if (coupon.startsAt && coupon.startsAt > now) return invalid;
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, message: "That promo code has expired." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: "That promo code has been fully redeemed." };
  }
  if (coupon.perPhoneLimit !== null && phone) {
    const used = await prisma.order.count({
      where: {
        couponId: coupon.id,
        customerPhone: phone,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    });
    if (used >= coupon.perPhoneLimit) {
      return { ok: false, message: "You've already used this promo code." };
    }
  }
  return {
    ok: true,
    id: coupon.id,
    usageLimit: coupon.usageLimit,
    terms: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minSubtotalFils: toFils(coupon.minSubtotal),
      maxDiscountFils: coupon.maxDiscount === null ? null : toFils(coupon.maxDiscount),
      description: coupon.description,
    },
  };
}
