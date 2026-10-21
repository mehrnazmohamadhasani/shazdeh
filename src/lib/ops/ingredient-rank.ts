/*
 * Ranks stock ingredients against a line as printed on an invoice
 * ("Rice (KG) Anjomam", "dried limon", "ONION RED 10KG"). Pure and
 * shared by the review screen's picker, so it runs as you type.
 *
 * Pack words and numbers are ignored, and words count as the same when
 * they are one or two letters apart ("limon" ≈ "lemon"), so handwritten
 * and transliterated names still find their ingredient. A Persian name
 * is compared as well; Persian/Arabic spellings and digits are evened
 * out by the assistant's normalizeText.
 */

import { normalizeText } from "./assistant/match";

export type Rankable = { id: string; name: string; nameFa?: string | null };
export type Ranked<T extends Rankable> = { item: T; score: number };

/** At or above this the match is shown as the likely one. */
export const STRONG_MATCH = 0.75;
/** Below this a match isn't worth suggesting. */
export const WEAK_MATCH = 0.35;

const NOISE = new Set([
  "kg", "kgs", "g", "gm", "gms", "gr", "gram", "grams", "l", "lt", "ltr", "ltrs", "litre", "liter", "ml",
  "pc", "pcs", "piece", "pieces", "pkt", "pkts", "pack", "packet", "ctn", "carton", "box", "bag", "bags",
  "tin", "can", "bottle", "btl", "jar", "x", "of", "the", "and", "&",
]);

/** One spelling (as for the assistant), accents off, pack words and amounts out. */
export function nameTokens(s: string): string[] {
  return normalizeText(s.normalize("NFKD").replace(/[̀-ͯ]/g, ""))
    .split(" ")
    .filter((w) => w && !NOISE.has(w) && !/^\d+([.,]\d+)?[a-z]*$/.test(w));
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 1 for the same word, less for near spellings, 0 for different words. */
function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  // "tomato" in "tomatoes", "chick" in "chickpeas" (only for real words).
  if (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.85;
  const longest = Math.max(a.length, b.length);
  if (longest < 4) return 0;
  const sim = 1 - editDistance(a, b) / longest;
  if (sim >= 0.7) return sim;
  // A word still being typed, one letter off the start of the other: "limo" → "lemon"
  // (same first letter, so "rice" doesn't find "diced").
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && short[0] === long[0] && editDistance(short, long.slice(0, short.length)) <= 1) return 0.7;
  return 0;
}

/** How much of `from` is found in `into`, 0..1. */
function coverage(from: string[], into: string[]): number {
  if (!from.length || !into.length) return 0;
  const total = from.reduce((sum, w) => sum + Math.max(...into.map((v) => wordSimilarity(w, v))), 0);
  return total / from.length;
}

/** Similarity of a printed line and an ingredient name, 0..1. */
export function nameScore(printed: string, name: string): number {
  const p = nameTokens(printed);
  const n = nameTokens(name);
  if (!p.length || !n.length) return 0;
  if (p.join(" ") === n.join(" ")) return 1;
  // Every word of the ingredient should be on the line; extra words on the
  // line (brand, grade) matter less.
  return Math.min(0.99, 0.7 * coverage(n, p) + 0.3 * coverage(p, n));
}

/** Ingredients best first, with their scores; those below `min` are left out. */
export function rankIngredients<T extends Rankable>(printed: string, items: T[], min = WEAK_MATCH): Ranked<T>[] {
  return items
    .map((item) => ({ item, score: Math.max(nameScore(printed, item.name), item.nameFa ? nameScore(printed, item.nameFa) : 0) }))
    .filter((r) => r.score >= min)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
}
