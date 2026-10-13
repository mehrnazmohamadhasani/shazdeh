/*
 * Pack sizes and stock units. Stock is counted in grams, millilitres or
 * pieces; invoices say "5 CTN" of "4 x 10 kg", "2 Pcs" of
 * "TOMATO PASTE 800G" or "15 kg". These helpers turn what is printed
 * into a stock quantity — or return null so a person is asked, never
 * guessed.
 */

export type BaseUnit = "g" | "ml" | "pcs";
export type Amount = { unit: BaseUnit; amount: number };

const MASS: Record<string, number> = { kg: 1000, kgs: 1000, kilo: 1000, g: 1, gm: 1, gms: 1, gr: 1, grams: 1, gram: 1 };
const VOLUME: Record<string, number> = { l: 1000, lt: 1000, ltr: 1000, litre: 1000, liter: 1000, ml: 1, cc: 1 };
const PIECES = new Set(["pc", "pcs", "piece", "pieces", "nos", "no", "ea", "each", "unit", "units"]);

function measure(value: number, unit: string): Amount | null {
  const u = unit.toLowerCase().replace(/\.$/, "");
  if (u in MASS) return { unit: "g", amount: value * MASS[u] };
  if (u in VOLUME) return { unit: "ml", amount: value * VOLUME[u] };
  if (PIECES.has(u)) return { unit: "pcs", amount: value };
  return null;
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`(kgs?|kilo|grams?|gms?|gm|gr|g|litre|liter|ltr|lt|l|ml|cc|pcs|pc|pieces?)`;
const MULTI = new RegExp(String.raw`${NUM}\s*[x×*]\s*${NUM}\s*${UNIT}\b`, "i");
const SINGLE = new RegExp(String.raw`${NUM}\s*${UNIT}\b`, "i");

const toNumber = (v: string) => Number(v.replace(",", "."));

/**
 * Size of one pack, from a pack-size column or a product name:
 * "4 x 10 kg" → 40000 g, "TOMATO PASTE 800G" → 800 g, "12×330ml" → 3960 ml.
 */
export function parsePackSize(text: string | null | undefined): Amount | null {
  if (!text) return null;
  const multi = MULTI.exec(text);
  if (multi) {
    const one = measure(toNumber(multi[2]), multi[3]);
    return one ? { unit: one.unit, amount: one.amount * toNumber(multi[1]) } : null;
  }
  const single = SINGLE.exec(text);
  if (single) return measure(toNumber(single[1]), single[2]);
  return null;
}

/**
 * Stock a purchase line adds, from what is printed. A weight/volume unit
 * on the line ("15 kg") is used directly; a count unit (Pcs, CTN, TIN…)
 * is multiplied by the pack size. Null when it can't be known.
 */
export function lineStockAmount(line: {
  quantity: number | null;
  unit: string | null;
  packSize: string | null;
  description: string;
}): Amount | null {
  if (line.quantity == null || !(line.quantity > 0)) return null;
  const direct = line.unit ? measure(1, line.unit.trim()) : null;
  if (direct && direct.unit !== "pcs") return { unit: direct.unit, amount: line.quantity * direct.amount };
  const pack = parsePackSize(line.packSize) ?? parsePackSize(line.description);
  if (pack) return { unit: pack.unit, amount: line.quantity * pack.amount };
  if (direct?.unit === "pcs") return { unit: "pcs", amount: line.quantity };
  return null;
}

/** 40000 g → "40 kg", 750 ml → "750 ml". */
export function formatAmount(amount: number, unit: BaseUnit): string {
  const round = (v: number) => Number(v.toFixed(2)).toLocaleString("en-AE");
  if (unit === "g") return Math.abs(amount) >= 1000 ? `${round(amount / 1000)} kg` : `${round(amount)} g`;
  if (unit === "ml") return Math.abs(amount) >= 1000 ? `${round(amount / 1000)} L` : `${round(amount)} ml`;
  return `${round(amount)} pcs`;
}

/** "  Fanoos  Sella 1121 " → "fanoos sella 1121" — the key for learned supplier items. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}
