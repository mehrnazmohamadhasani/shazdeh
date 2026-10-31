import { z } from "zod";

/*
 * How one invoice unit is packed: "1 CTN" of "4 x 5 L", "4 Pcs" of
 * "2500G X 6 PCS", "10 box" of 12 packs of 20 dates. A pack is the inner
 * levels (counts, with a name such as "baste") and what the smallest one
 * holds. Stock is only ever grams or pieces, because recipes are: litres
 * count 1 L = 1 kg, pounds and ounces become grams.
 *
 * The AI reads a pack; code also works out the packs the printed text
 * allows. When more than one is possible ("4 Pcs" of "2500G X 6": a tub
 * or a box of six?) the last price decides, or a person is asked. Pure,
 * so it is tested on its own and shared by the server and the review
 * screen.
 */

export const PACK_UNITS = ["g", "kg", "lb", "oz", "ml", "l", "pcs"] as const;
export type PackUnit = (typeof PACK_UNITS)[number];
/** What stock is kept in. */
export type StockBase = "g" | "pcs";

export const packSchema = z.object({
  inner: z.array(z.object({ count: z.number().positive(), name: z.string().trim().max(30) })).max(4),
  amount: z.number().positive(),
  unit: z.enum(PACK_UNITS),
});
export type Pack = z.infer<typeof packSchema>;

/** Grams (or pieces) in one of each unit. 1 L = 1 kg in SHĀZDEH. */
const FACTOR: Record<PackUnit, number> = { g: 1, kg: 1000, lb: 453.6, oz: 28.35, ml: 1, l: 1000, pcs: 1 };
export const baseOf = (unit: PackUnit): StockBase => (unit === "pcs" ? "pcs" : "g");
export const isMeasure = (unit: PackUnit) => unit !== "pcs";

/** Words printed after a number, in English, Arabic and Persian. */
const WORDS: [PackUnit, string[]][] = [
  ["kg", ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms", "kgr", "k gr", "k.g", "کیلو", "كيلو", "كغ", "کیلوگرم"]],
  ["g", ["g", "gm", "gms", "gr", "grm", "grms", "gram", "grams", "gramme", "گرم", "غ", "جرام", "غرام"]],
  ["lb", ["lb", "lbs", "pound", "pounds"]],
  ["oz", ["oz", "ounce", "ounces"]],
  ["l", ["l", "lt", "ltr", "ltrs", "lit", "litr", "litre", "litres", "liter", "liters", "لیتر", "لتر"]],
  ["ml", ["ml", "mls", "cc", "میلی‌لیتر", "مل"]],
  ["pcs", ["pc", "pcs", "pce", "pces", "piece", "pieces", "ea", "each", "nos", "no", "unit", "units", "adad", "dune", "dane", "عدد", "دونه", "دانه", "حبة"]],
];
const WORD_UNIT = new Map(WORDS.flatMap(([u, ws]) => ws.map((w) => [w, u] as const)));

/** "KGS" → kg, "Ltr." → l, "عدد" → pcs; null for "CTN", "box" and other pack names. */
export function unitWord(word: string | null | undefined): PackUnit | null {
  if (!word) return null;
  const w = word.toLowerCase().trim().replace(/\.$/, "").replace(/\s+/g, " ");
  return WORD_UNIT.get(w) ?? null;
}

/** Printed units that name a case of several packs. */
const CASE = /^(ctn|ctns|carton|cartons|ct|cs|case|cases|box|boxes|bx|outer|tray|کارتن|جعبه|كرتون)$/i;
export const isCaseWord = (word: string | null | undefined) => !!word && CASE.test(word.trim().replace(/\.$/, ""));

const UNIT_RE = String.raw`(kgs?|kilos?|k\s?gr|kgr|grams?|grms?|grm|gms?|gm|gr|g|lbs?|oz|litres?|liters?|ltrs?|ltr|lit|lt|l|mls?|cc|pcs|pce|pc|pieces?)`;
const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
/** "4X5L", "24 x 330ml", "12X1 KGS", "10 X 100" (count × size). */
const COUNT_SIZE = new RegExp(String.raw`\b${NUM}\s*[x×*]\s*${NUM}(?![\d.,])\s*${UNIT_RE}?(?![a-z])(?![-/])(?!\s*(?:cm|mm|inch|[x×*]))`, "i");
/** "2500G X 6 PCS" (size × count). */
const SIZE_COUNT = new RegExp(String.raw`\b${NUM}\s*${UNIT_RE}\s*[x×*]\s*${NUM}(?![\d.,])(?!\s*(?:cm|mm|inch))`, "i");
/** "700G", "25GM", "9kg bucket", "1 K gr", "35 LB", "1L". */
const SIZE = new RegExp(String.raw`\b${NUM}\s*${UNIT_RE}(?![a-z])`, "i");
const toNumber = (v: string) => Number(v.replace(",", "."));

/** One invoice unit of this pack, in grams or pieces. */
export function perUnit(pack: Pack): { base: StockBase; amount: number } {
  const inner = pack.inner.reduce((p, l) => p * l.count, 1);
  return { base: baseOf(pack.unit), amount: inner * pack.amount * FACTOR[pack.unit] };
}

/** What the whole line adds to stock. */
export function packStock(quantity: number, pack: Pack) {
  const one = perUnit(pack);
  return { base: one.base, amount: quantity * one.amount };
}

const sameAmount = (a: Pack, b: Pack) => {
  const x = perUnit(a);
  const y = perUnit(b);
  return x.base === y.base && Math.abs(x.amount - y.amount) < 1e-6;
};

/**
 * The packs the printed line allows, most likely first. Empty when
 * nothing says how much is in one unit (a handwritten "2 ct"): a person
 * is asked.
 */
export function packOptions(line: { unit: string | null; packSize: string | null; description: string }, opts: { meat?: boolean } = {}): Pack[] {
  const printed = line.unit?.trim() || null;
  const direct = unitWord(printed);
  // "25 kg", "45 KG", "2 KGS": the quantity is already the amount.
  if (direct && isMeasure(direct)) return [{ inner: [], amount: 1, unit: direct }];
  // Butchers print "33" and a price per kg.
  if (!printed && opts.meat) return [{ inner: [], amount: 1, unit: "kg" }];

  const options: Pack[] = [];
  const add = (p: Pack) => {
    if (p.amount > 0 && !options.some((o) => sameAmount(o, p))) options.push(p);
  };
  const caseFirst = isCaseWord(printed);
  for (const text of [line.packSize, line.description]) {
    if (!text) continue;
    const sc = SIZE_COUNT.exec(text);
    const cs = sc ? null : COUNT_SIZE.exec(text);
    if (sc || cs) {
      const [count, size, word] = sc ? [toNumber(sc[3]), toNumber(sc[1]), sc[2]] : [toNumber(cs![1]), toNumber(cs![2]), cs![3]];
      const unit = unitWord(word) ?? "pcs";
      const box: Pack = { inner: count > 1 ? [{ count, name: "" }] : [], amount: size, unit };
      const one: Pack = { inner: [], amount: size, unit };
      // A carton holds the count; a "Pcs" or "PKT" is usually one of them.
      for (const p of caseFirst ? [box, one] : [one, box]) add(p);
      break;
    }
    const s = SIZE.exec(text);
    if (s) {
      const unit = unitWord(s[2]);
      if (unit) add({ inner: [], amount: toNumber(s[1]), unit });
      break;
    }
  }
  if (!options.length && direct === "pcs") add({ inner: [], amount: 1, unit: "pcs" });
  return options;
}

/**
 * Picks the pack whose price per gram (or piece) is closest to the last
 * one paid. Sure when only one pack fits, or the best one is close to the
 * last price and no other is.
 */
export function choosePack(options: Pack[], quantity: number | null, netAed: number | null, lastFilsPerBase: number | null): { pack: Pack | null; sure: boolean } {
  if (!options.length) return { pack: null, sure: false };
  if (options.length === 1) return { pack: options[0], sure: true };
  if (!quantity || !netAed || !lastFilsPerBase) return { pack: options[0], sure: false };
  const distance = (p: Pack) => Math.abs(Math.log((netAed * 100) / packStock(quantity, p).amount / lastFilsPerBase));
  const ranked = [...options].sort((a, b) => distance(a) - distance(b));
  const near = (p: Pack) => distance(p) < Math.log(1.5);
  return { pack: ranked[0], sure: near(ranked[0]) && !ranked.slice(1).some(near) };
}

/** Pack from the old memory (one number per invoice unit). */
export function packFromBase(amountPerUnit: number, base: "g" | "ml" | "pcs"): Pack {
  if (base === "pcs") return { inner: [], amount: amountPerUnit, unit: "pcs" };
  return amountPerUnit >= 1000 ? { inner: [], amount: amountPerUnit / 1000, unit: "kg" } : { inner: [], amount: amountPerUnit, unit: "g" };
}

/** Pack stored in JSON (memory, a saved line), if it is one. */
export function readPack(value: unknown): Pack | null {
  const parsed = packSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
