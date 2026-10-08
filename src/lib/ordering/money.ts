/*
 * Money helpers for online ordering.
 *
 * Orders are priced in integer fils (1 AED = 100 fils) so sums never
 * pick up floating-point dust. Menu prices are still typed by staff in
 * AED, so everything crosses this boundary exactly once.
 */

export const CURRENCY = "AED";

export function toFils(aed: number): number {
  return Math.round(aed * 100);
}

export function fromFils(fils: number): number {
  return fils / 100;
}

/** 12800 → "128 AED", 1167 → "11.67 AED" — matches the menu's price style. */
export function formatFils(fils: number, currency = CURRENCY): string {
  const whole = fils % 100 === 0;
  const formatted = new Intl.NumberFormat("en-AE", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(fils / 100);
  return `${formatted} ${currency}`;
}
