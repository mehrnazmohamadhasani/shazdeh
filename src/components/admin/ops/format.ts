import { formatAmount, type BaseUnit } from "@/lib/ops/units";
import type { AdminLocale } from "@/lib/admin-i18n";

/** Shared display helpers for the purchasing screens (Dubai time). */

export const UNIT: Record<string, BaseUnit> = { G: "g", ML: "ml", PCS: "pcs" };

/** Unit names as printed after a number, per admin language. */
const UNIT_FA: Record<string, string> = { g: "گرم", kg: "کیلو", ml: "میلی‌لیتر", L: "لیتر", pcs: "عدد", pc: "عدد" };

/** Pass `intl` from the admin i18n helpers; English stays the default. */
export function day(d: Date | string, withYear = false, intl = "en-AE") {
  return new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "Asia/Dubai",
  }).format(new Date(d));
}

/** Cost per kg / L / piece, from fils per g / ml / piece. */
export function unitPrice(filsPerBase: number, unit: BaseUnit, locale: AdminLocale = "en") {
  const per = unit === "pcs" ? 1 : 1000;
  const big = unit === "g" ? "kg" : unit === "ml" ? "L" : "pc";
  const value = ((filsPerBase * per) / 100).toFixed(2);
  return locale === "fa" ? `${value} درهم / ${UNIT_FA[big]}` : `${value} AED / ${big}`;
}

/** `formatAmount` ("40 kg", "750 ml") with Persian unit names when asked. */
export function amountText(amount: number, unit: BaseUnit, locale: AdminLocale = "en") {
  const text = formatAmount(amount, unit);
  if (locale !== "fa") return text;
  const i = text.lastIndexOf(" ");
  return `${text.slice(0, i)} ${UNIT_FA[text.slice(i + 1)] ?? text.slice(i + 1)}`;
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

/** 0 = Sunday, as stored on suppliers. */
export function weekday(i: number, locale: AdminLocale = "en") {
  return (locale === "fa" ? WEEKDAY_FA : WEEKDAY_SHORT)[i];
}
