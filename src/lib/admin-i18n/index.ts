import { FA } from "./fa";

/*
 * Admin panel language — English (default) or Persian.
 *
 * The English text *is* the key: `t("Save changes")` returns the Persian
 * from the dictionary in `./fa`, or the English unchanged when no
 * translation exists (so a missing entry never breaks a screen). Values
 * are interpolated with `{name}` placeholders:
 *
 *   t("{n} in progress", { n: 3 })
 *
 * When one English word needs two Persian words, pass a context and add
 * a "context|English" entry: `t("Subtotal", { context: "invoice" })`.
 *
 * Safe on the server and in the browser; see `./server` for reading the
 * choice from the cookie and `@/components/admin/i18n` for the hook.
 */

export const ADMIN_LOCALES = ["en", "fa"] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];
export const DEFAULT_ADMIN_LOCALE: AdminLocale = "en";
export const ADMIN_LOCALE_COOKIE = "admin-locale";

export function parseAdminLocale(value: string | null | undefined): AdminLocale {
  return value === "fa" ? "fa" : DEFAULT_ADMIN_LOCALE;
}

export type TranslateVars = Record<string, string | number>;
export type Translate = (text: string, vars?: TranslateVars) => string;

const warned = new Set<string>();

/*
 * In Persian each value is wrapped in Unicode first-strong isolates
 * (FSI … PDI) so a Latin name or a number inside a Persian sentence keeps
 * its own order: «هزینه‌ی ارسال (jumeirah 1)», not «(1 jumeirah)».
 */
function interpolate(text: string, vars?: TranslateVars, isolate = false) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? (isolate ? `\u2068${vars[k]}\u2069` : String(vars[k])) : m,
  );
}

export function createAdminI18n(locale: AdminLocale) {
  const fa = locale === "fa";

  const t: Translate = (text, vars) => {
    if (!fa) return interpolate(text, vars);
    const hit = (vars?.context !== undefined ? FA[`${vars.context}|${text}`] : undefined) ?? FA[text];
    if (hit === undefined && process.env.NODE_ENV !== "production" && !warned.has(text)) {
      warned.add(text);
      console.warn(`[admin-i18n] missing fa: ${JSON.stringify(text)}`);
    }
    return interpolate(hit ?? text, vars, true);
  };

  /** Stored text (event messages…): Persian when it is a known fixed sentence, else as stored. */
  const tData = (text: string) => (fa ? (FA[text] ?? text) : text);

  /*
   * Persian keeps the Gregorian calendar and Latin digits on purpose:
   * supplier invoices, printed tickets, order numbers and phone numbers
   * in Dubai all use them, so the panel matches the paper in hand.
   */
  const intl = fa ? "fa-u-ca-gregory-nu-latn" : "en-AE";
  const currency = fa ? "درهم" : "AED";

  function number(n: number, digits?: { min?: number; max?: number }) {
    return new Intl.NumberFormat(intl, {
      minimumFractionDigits: digits?.min,
      maximumFractionDigits: digits?.max,
    }).format(n);
  }

  /** 12800 → "128 AED" / "128 درهم" (fils in, like `formatFils`). */
  function money(fils: number) {
    const whole = fils % 100 === 0;
    return `${number(fils / 100, { min: whole ? 0 : 2, max: whole ? 0 : 2 })} ${currency}`;
  }

  /** Whole-dirham menu prices (like `formatPrice`). */
  function price(aed: number) {
    return `${number(aed, { min: 0, max: 0 })} ${currency}`;
  }

  /** Dates and times, always in Dubai time. */
  function date(d: Date | string | number, opts: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(intl, { timeZone: "Asia/Dubai", ...opts }).format(new Date(d));
  }

  return {
    locale,
    dir: fa ? ("rtl" as const) : ("ltr" as const),
    /** BCP 47 tag for `Intl` / `toLocaleString`. */
    intl,
    currency,
    t,
    tData,
    number,
    money,
    price,
    date,
  };
}

export type AdminI18n = ReturnType<typeof createAdminI18n>;
