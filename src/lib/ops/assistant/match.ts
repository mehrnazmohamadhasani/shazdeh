/*
 * Finding what someone meant by a name they said or typed: "beef",
 * "گوشت گوساله", "قرمه سبزی", "Ghormeh Sabzi", an Arabic spelling, or a
 * name learned from a recipe sheet. Pure (no database), so it is tested
 * on its own and shared by every assistant tool.
 *
 * Never guesses: one clear match is used; several close ones come back
 * as choices for the person to pick from.
 */

export type Named = { id: string; name: string; nameFa: string | null; aliases?: string[] };

export type MatchResult<T extends Named> =
  | { ok: true; item: T }
  | { ok: false; reason: "not_found"; suggestions: T[] }
  | { ok: false; reason: "ambiguous"; candidates: T[] };

const DIGITS: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/**
 * One spelling for Persian, Arabic and English: Arabic yeh/kaf/teh
 * marbuta/hamza forms become Persian ones, diacritics, tatweel and
 * zero-width joiners go, Eastern digits become Latin, Latin is lower-cased
 * and transliteration variants are evened out (gh/q, ee/i, oo/u).
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d])
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ی")
    .replace(/[ً-ٰٟـ]/g, "") // harakat, superscript alef, tatweel
    .replace(/[‌‍‎‏]/g, " ") // ZWNJ / ZWJ / direction marks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/gh/g, "q")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance, capped (returns cap + 1 once it is exceeded). */
function distance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** 0 (no match) … 100 (same name). */
export function nameScore(query: string, name: string): number {
  const q = normalizeText(query);
  const n = normalizeText(name);
  if (!q || !n) return 0;
  if (q === n) return 100;
  const qWords = q.split(" ");
  const nWords = n.split(" ");
  // Every word said is (the start of) a word of the name: "beef" → "beef topside".
  if (qWords.every((w) => nWords.some((x) => x.startsWith(w)))) return 80 - Math.min(20, nWords.length - qWords.length) * 2;
  if (n.includes(q) || q.includes(n)) return 70;
  // Mis-hearings and misspellings: "gormeh sabsi" → "ghormeh sabzi".
  const cap = Math.max(1, Math.floor(n.length / 5));
  const d = distance(q, n, cap);
  if (d <= cap) return 70 - d * 5;
  return 0;
}

function bestScore(query: string, item: Named): number {
  return Math.max(nameScore(query, item.name), item.nameFa ? nameScore(query, item.nameFa) : 0, ...(item.aliases ?? []).map((a) => nameScore(query, a)));
}

/**
 * The item `query` names, by id, English name, Persian name or a learned
 * alias. A clear winner is used; two that score alike are "ambiguous".
 */
export function findByName<T extends Named>(query: string, items: T[]): MatchResult<T> {
  const byId = items.find((i) => i.id === query);
  if (byId) return { ok: true, item: byId };
  const scored = items
    .map((item) => ({ item, score: bestScore(query, item) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { ok: false, reason: "not_found", suggestions: [] };
  const [top, next] = scored;
  if (top.score === 100 && (!next || next.score < 100)) return { ok: true, item: top.item };
  if (top.score >= 60 && (!next || top.score - next.score >= 10)) return { ok: true, item: top.item };
  const close = scored.filter((s) => s.score >= top.score - 10).slice(0, 5).map((s) => s.item);
  if (top.score >= 60) return { ok: false, reason: "ambiguous", candidates: close };
  return { ok: false, reason: "not_found", suggestions: close };
}

// ─── Amounts ────────────────────────────────────────────────────────────────

export type StockUnit = "G" | "ML" | "PCS";
export const SPOKEN_UNITS = ["g", "kg", "ml", "l", "pcs"] as const;
export type SpokenUnit = (typeof SPOKEN_UNITS)[number];

/**
 * An amount someone said ("2 kg") in the ingredient's own unit, or null
 * when the two don't fit (kilos of something counted in pieces).
 */
export function toStockUnit(quantity: number, unit: SpokenUnit, stockUnit: StockUnit): number | null {
  if (!Number.isFinite(quantity)) return null;
  switch (stockUnit) {
    case "G":
      return unit === "g" ? quantity : unit === "kg" ? quantity * 1000 : null;
    case "ML":
      return unit === "ml" ? quantity : unit === "l" ? quantity * 1000 : null;
    case "PCS":
      return unit === "pcs" ? quantity : null;
  }
}

// ─── What needs a second confirmation ──────────────────────────────────────

/** A counted difference this big (share of the book amount, or value) is checked twice. */
export const BIG_COUNT_SHARE = 0.2;
export const BIG_COUNT_FILS = 10_000;

export function bigCountDifference(before: number, after: number, valueFils: number | null): boolean {
  const diff = Math.abs(after - before);
  if (diff === 0) return false;
  if (valueFils != null && Math.abs(valueFils) >= BIG_COUNT_FILS) return true;
  if (before <= 0) return after > 0;
  return diff / before > BIG_COUNT_SHARE;
}

// ─── Dates ──────────────────────────────────────────────────────────────────

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A day the model passed: "YYYY-MM-DD" within the last 62 days and not
 * in the future (Dubai). Anything else is refused rather than guessed.
 */
export function checkDay(day: string | null | undefined, today: string): { ok: true; day: string } | { ok: false; error: string } {
  if (!day) return { ok: true, day: today };
  if (!DAY_RE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return { ok: false, error: `"${day}" is not a date (YYYY-MM-DD).` };
  if (day > today) return { ok: false, error: "That day is in the future." };
  const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000;
  if (age > 62) return { ok: false, error: "That is more than two months ago; change it on its own screen." };
  return { ok: true, day };
}
