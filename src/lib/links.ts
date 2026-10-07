/*
 * Outbound link helpers shared by the public site.
 * SHĀZDEH is delivery-only: every "order" affordance resolves to a
 * delivery partner or a direct WhatsApp conversation.
 */

/** Platforms that take orders, in the order we prefer to show them. */
export const DELIVERY_PLATFORMS = [
  "talabat",
  "careem",
  "keeta",
  "deliveroo",
  "noon",
] as const;

export function isDeliveryPlatform(platform: string) {
  return (DELIVERY_PLATFORMS as readonly string[]).includes(
    platform.toLowerCase(),
  );
}

/** wa.me deep link from a stored number (any formatting) or URL. */
export function whatsappHref(
  numberOrUrl: string | null | undefined,
  text?: string,
): string | undefined {
  if (!numberOrUrl) return undefined;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  if (/^https?:\/\//i.test(numberOrUrl)) {
    const digits = numberOrUrl.match(/wa\.me\/(\d+)/)?.[1];
    return digits ? `https://wa.me/${digits}${query}` : numberOrUrl;
  }
  const digits = numberOrUrl.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}${query}` : undefined;
}

/** Allow only link protocols that are safe to render as an href. */
export function isSafeHref(url: string) {
  const trimmed = url.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  return /^(https?:|mailto:|tel:)/i.test(trimmed);
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
