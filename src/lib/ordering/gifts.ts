import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { sendGiftEmail } from "@/lib/notifications";
import { maskEmail, offerLabel } from "@/lib/ordering/gift-utils";

/*
 * QR gifts (see gift-utils.ts for the flow). Like promo codes, nothing
 * here trusts the browser: the gift is found by mobile on the server
 * and used up inside the order transaction (orders.ts).
 */

export type GiftOffer = {
  code: string;
  offer: string;
  note: string | null;
  minSubtotal: number;
  endsAt: Date | null;
};

/** A gift that can still be claimed right now, or null. */
export async function findGiftOffer(rawCode: string, now = new Date()): Promise<GiftOffer | null> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return null;
  const c = await prisma.coupon.findUnique({ where: { code } });
  if (!c || !c.isGift || !c.isActive) return null;
  if ((c.startsAt && c.startsAt > now) || (c.endsAt && c.endsAt < now)) return null;
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return null;
  return { code: c.code, offer: offerLabel(c.type, c.value), note: c.description, minSubtotal: c.minSubtotal, endsAt: c.endsAt };
}

/** Counts one scan of the printed QR (the caller rate-limits per device). */
export async function countGiftScan(rawCode: string) {
  await prisma.coupon
    .updateMany({ where: { code: rawCode.trim().toUpperCase(), isGift: true }, data: { scanCount: { increment: 1 } } })
    .catch((e) => console.error("[gift] scan count failed", e));
}

/** Has this mobile ordered before (anything not cancelled or rejected)? */
export async function hasEarlierOrder(phone: string) {
  const n = await prisma.order.count({ where: { customerPhone: phone, status: { notIn: ["CANCELLED", "REJECTED"] } } });
  return n > 0;
}

export type ClaimResult =
  | { ok: true; email: string; emailSent: boolean }
  | { ok: false; status: number; error: string };

/**
 * Saves (or refreshes) a claim — the gift works from now on for this
 * mobile — and emails it as a reminder. Claiming again with the same
 * mobile updates the email and re-sends it; a gift already used stays used.
 */
export async function claimGift(input: {
  code: string;
  name: string | null;
  phone: string;
  email: string;
  marketingOptIn: boolean;
}): Promise<ClaimResult> {
  const offer = await findGiftOffer(input.code);
  if (!offer) return { ok: false, status: 404, error: "This gift has ended or isn't available." };
  const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: offer.code } });
  const email = input.email.trim().toLowerCase();

  if (coupon.firstOrderOnly && (await hasEarlierOrder(input.phone))) {
    return { ok: false, status: 409, error: "This gift is for your first order on our website — and you've already ordered with us. Thank you!" };
  }

  const [byPhone, byEmail] = await Promise.all([
    prisma.giftClaim.findUnique({ where: { couponId_phone: { couponId: coupon.id, phone: input.phone } } }),
    prisma.giftClaim.findUnique({ where: { couponId_email: { couponId: coupon.id, email } } }),
  ]);
  if (byEmail && byEmail.phone !== input.phone) {
    return { ok: false, status: 409, error: "This email has already claimed the gift with another mobile number." };
  }
  if (byPhone?.orderId) return { ok: false, status: 409, error: "You've already used this gift. Thank you for ordering with us!" };

  const claim = byPhone
    ? await prisma.giftClaim.update({
        where: { id: byPhone.id },
        data: {
          name: input.name ?? byPhone.name,
          email,
          ...(input.marketingOptIn ? { marketingOptIn: true } : {}),
        },
      })
    : await prisma.giftClaim.create({
        data: {
          couponId: coupon.id,
          name: input.name,
          phone: input.phone,
          email,
          marketingOptIn: input.marketingOptIn,
          token: randomBytes(18).toString("base64url"),
        },
      });

  const emailStatus = await sendGiftEmail({
    email: claim.email,
    name: claim.name,
    offer: offer.offer,
    note: offer.note,
    endsAt: offer.endsAt,
    giftUrl: absoluteUrl(`/gift/activate/${claim.token}`),
  });
  await prisma.giftClaim.update({ where: { id: claim.id }, data: { emailStatus } });
  return { ok: true, email: maskEmail(claim.email), emailSent: emailStatus === "sent" };
}

/** The link in the email: shows the gift, and notes (once) that the email was opened. */
export async function openGiftLink(token: string) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return null;
  const claim = await prisma.giftClaim.findUnique({ where: { token }, include: { coupon: true } });
  if (!claim) return null;
  if (!claim.activatedAt) await prisma.giftClaim.update({ where: { id: claim.id }, data: { activatedAt: new Date() } });
  const { coupon } = claim;
  return {
    phone: claim.phone,
    name: claim.name,
    used: claim.orderId !== null,
    ended: !coupon.isActive || (coupon.endsAt !== null && coupon.endsAt < new Date()),
    code: coupon.code,
    offer: offerLabel(coupon.type, coupon.value),
    note: coupon.description,
    minSubtotal: coupon.minSubtotal,
    endsAt: coupon.endsAt,
  };
}

/** The gift checkout should apply for this mobile: the newest unused claim on a live gift. */
export async function giftForPhone(phone: string, now = new Date()): Promise<{ claimId: string; code: string } | null> {
  const claims = await prisma.giftClaim.findMany({
    where: {
      phone,
      orderId: null,
      coupon: {
        isGift: true,
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    },
    include: { coupon: { select: { code: true } } },
    orderBy: { createdAt: "desc" },
  });
  return claims[0] ? { claimId: claims[0].id, code: claims[0].coupon.code } : null;
}
