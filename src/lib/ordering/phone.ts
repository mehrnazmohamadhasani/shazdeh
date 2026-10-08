/*
 * UAE mobile numbers. Riders call or WhatsApp the customer, so checkout
 * asks for a UAE mobile (05x / +9715x) and stores it in E.164.
 */

const UAE_MOBILE = /^5[024568]\d{7}$/;

/** "050 123 4567" | "+971 50 123 4567" | "00971501234567" → "+971501234567" */
export function normalizeUaeMobile(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("971")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return UAE_MOBILE.test(digits) ? `+971${digits}` : null;
}

/** "+971501234567" → "+971 50 123 4567" */
export function formatUaeMobile(e164: string): string {
  const m = e164.match(/^\+971(\d{2})(\d{3})(\d{4})$/);
  return m ? `+971 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** "+971501234567" → "+971 50 ••• 4567" — for customer-visible pages. */
export function maskPhone(e164: string): string {
  const m = e164.match(/^\+971(\d{2})\d{3}(\d{4})$/);
  return m ? `+971 ${m[1]} ••• ${m[2]}` : "••••";
}
