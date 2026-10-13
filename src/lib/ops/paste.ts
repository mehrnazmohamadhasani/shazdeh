import type { BaseUnit } from "./units";

/*
 * Stock lists pasted from Excel (or typed one item per line) for the
 * opening stock: name, quantity, unit, price per unit — separated by
 * tabs, semicolons or commas. "Sella rice 200 kg 5.25" also works.
 * Quantities come back in kg / L / pieces and prices per kg / L / piece,
 * whatever unit was typed (g and ml are converted). Unknown units → kg.
 */

const UNIT_WORDS: Record<string, { unit: BaseUnit; per: number }> = {
  kg: { unit: "g", per: 1 },
  kgs: { unit: "g", per: 1 },
  kilo: { unit: "g", per: 1 },
  "کیلو": { unit: "g", per: 1 },
  g: { unit: "g", per: 0.001 },
  gr: { unit: "g", per: 0.001 },
  gram: { unit: "g", per: 0.001 },
  "گرم": { unit: "g", per: 0.001 },
  l: { unit: "ml", per: 1 },
  lt: { unit: "ml", per: 1 },
  ltr: { unit: "ml", per: 1 },
  litre: { unit: "ml", per: 1 },
  liter: { unit: "ml", per: 1 },
  "لیتر": { unit: "ml", per: 1 },
  ml: { unit: "ml", per: 0.001 },
  pc: { unit: "pcs", per: 1 },
  pcs: { unit: "pcs", per: 1 },
  "عدد": { unit: "pcs", per: 1 },
};

export type StockLine = { name: string; unit: BaseUnit; quantity: number | null; price: number | null };

function num(v: string | undefined): number | null {
  if (!v) return null;
  // Persian/Arabic digits, and 1,234.5 / 1234,5
  const t = v
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(",", ".")
    .trim();
  const n = Number(t);
  return t && Number.isFinite(n) ? n : null;
}

const round = (n: number, d: number) => Number(n.toFixed(d));

export function parseStockLines(text: string): StockLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      let cells = line.split(/\t|;|،|,(?=\s|$)/).map((c) => c.trim()).filter(Boolean);
      if (cells.length === 1) {
        const m = /^(.*?)\s+([\d.,۰-۹]+)\s*([^\d\s۰-۹]+)?\s*([\d.,۰-۹]+)?$/.exec(line);
        if (m) cells = [m[1], m[2], m[3] ?? "", m[4] ?? ""];
      }
      const [name = "", qtyCell, unitCell = "", priceCell] = cells;
      const word = UNIT_WORDS[unitCell.toLowerCase()];
      const per = word?.per ?? 1;
      const q = num(qtyCell);
      const p = num(priceCell);
      return {
        name,
        unit: word?.unit ?? "g",
        quantity: q == null ? null : round(q * per, 3),
        price: p == null ? null : round(p / per, 4),
      };
    })
    .filter((l) => l.name);
}
