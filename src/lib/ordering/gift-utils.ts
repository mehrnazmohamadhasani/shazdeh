/*
 * QR gifts — the pure parts, shared by the server, the admin screens and
 * the tests. A gift is a Coupon with isGift: the printed QR opens
 * /g/CODE (counts the scan) → /gift/CODE, where the customer leaves a
 * mobile and an email; from then on checkout applies it by itself for
 * that mobile. The email is a reminder of the gift.
 */

/** The short link printed in the QR — short links make a simpler, easier-to-scan code. */
export function giftScanPath(code: string) {
  return `/g/${encodeURIComponent(code)}`;
}

/** "maryam.k@gmail.com" → "ma•••@gmail.com" — enough to recognise, not to read off a screen. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "•••";
  return `${user.slice(0, Math.min(2, user.length - 1) || 1)}•••@${domain}`;
}

export type GiftStatus = "used" | "ready" | "expired";

/** Where one claim stands, for the admin list. */
export function giftStatus(
  claim: { orderId: string | null },
  coupon: { isActive: boolean; endsAt: Date | string | null },
  now = new Date(),
): GiftStatus {
  if (claim.orderId) return "used";
  const ended = coupon.endsAt !== null && new Date(coupon.endsAt) < now;
  if (!coupon.isActive || ended) return "expired";
  return "ready";
}

/** "15% off" | "AED 20 off" | "Free delivery" — the headline on the gift page and email. */
export function offerLabel(type: "PERCENT" | "FIXED" | "FREE_DELIVERY", value: number): string {
  if (type === "FREE_DELIVERY") return "Free delivery";
  return type === "PERCENT" ? `${value}% off` : `AED ${value} off`;
}

/** "31 December 2026", in Dubai time. */
export function formatGiftDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai" }).format(new Date(d));
}
