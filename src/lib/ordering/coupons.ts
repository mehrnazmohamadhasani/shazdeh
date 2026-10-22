import "server-only";
import { prisma } from "@/lib/prisma";
import { toFils } from "@/lib/ordering/money";
import type { CouponTerms } from "@/lib/ordering/pricing";

export type CouponLookup =
  | { ok: true; id: string; usageLimit: number | null; terms: CouponTerms; giftClaimId: string | null }
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
  if (coupon.firstOrderOnly && phone) {
    const earlier = await prisma.order.count({
      where: { customerPhone: phone, status: { notIn: ["CANCELLED", "REJECTED"] } },
    });
    if (earlier > 0) return { ok: false, message: "This offer is for your first order on our website." };
  }
  // A QR gift belongs to the mobile that claimed it.
  let giftClaimId: string | null = null;
  if (coupon.isGift) {
    const claim = phone
      ? await prisma.giftClaim.findUnique({ where: { couponId_phone: { couponId: coupon.id, phone } } })
      : null;
    if (!claim) return { ok: false, message: "This gift is claimed by scanning the QR card from your SHĀZDEH order." };
    if (claim.orderId) return { ok: false, message: "You've already used this gift." };
    giftClaimId = claim.id;
  }
  return {
    ok: true,
    id: coupon.id,
    giftClaimId,
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
