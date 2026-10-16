import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/core";
// Mobile-number rules for every country, passed explicitly so the same
// code works in Next.js and under the tsx test runner.
import metadata from "libphonenumber-js/mobile/metadata";

/*
 * Customer mobile numbers. Riders call or WhatsApp the customer, so
 * checkout asks for a mobile number — from any country — and stores it in
 * E.164. A number typed without a country code is read as a UAE number
 * ("050 123 4567"); others need theirs ("+44 7911 123456"). Validation
 * uses libphonenumber's per-country mobile rules.
 */

const DEFAULT_COUNTRY = "AE";

/**
 * A number typed without a country code is read in `country` (UAE unless
 * staff picked another); one with +code or 00code is read as written.
 */
function parse(input: string, country: string = DEFAULT_COUNTRY) {
  let v = input.trim();
  if (v.startsWith("00")) v = `+${v.slice(2)}`; // 00 44 … is the same as +44 …
  return parsePhoneNumberFromString(v, country as CountryCode, metadata);
}

/** "050 123 4567" | "+971 50 123 4567" | "0044 7911 123456" → "+971501234567" | "+447911123456"; null if not a valid mobile. */
export function normalizeMobile(input: string, country?: string): string | null {
  const phone = parse(input, country);
  return phone?.isValid() ? phone.number : null;
}

/** A valid mobile with the country it belongs to, for showing back what was understood. */
export function readMobile(input: string, country?: string): { e164: string; country: string | null; international: string } | null {
  const phone = parse(input, country);
  if (!phone?.isValid()) return null;
  return { e164: phone.number, country: phone.country ?? null, international: phone.formatInternational() };
}

/** Every country with its calling code ("DE" → "49"), for a country picker. */
export function mobileCountries(): { code: string; callingCode: string }[] {
  return getCountries(metadata).map((code) => ({ code, callingCode: getCountryCallingCode(code, metadata) }));
}

/** "+971501234567" → "+971 50 123 4567" */
export function formatPhone(e164: string): string {
  return parse(e164)?.formatInternational() ?? e164;
}

/** "+971501234567" → "+971 50 ••• 4567" — for customer-visible pages. */
export function maskPhone(e164: string): string {
  const phone = parse(e164);
  if (!phone) return "••••";
  const national = String(phone.nationalNumber);
  return `+${phone.countryCallingCode} ${national.slice(0, 2)} ••• ${national.slice(-4)}`;
}
