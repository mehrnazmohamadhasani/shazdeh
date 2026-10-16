import { lineNet } from "../costing";

/*
 * "Fix yesterday's rice price: 38 not 35" — the line and invoice totals
 * after correcting one unit price, in fils. The line total moves in
 * proportion to (quantity × price − discount), so a line printed with its
 * VAT keeps it; VAT added once at the bottom moves by 5 % of the change.
 * Pure, so the arithmetic is tested on its own.
 */

const VAT_RATE = 0.05;

export type FixLine = { id: string; quantity: number; unitPriceFils: number | null; discountFils: number; vatFils: number | null; lineTotalFils: number };
export type FixInvoice = { pricesIncludeVat: boolean; subtotalFils: number | null; vatFils: number | null; totalFils: number; lines: FixLine[] };

export type FixResult =
  | {
      ok: true;
      line: { unitPriceFils: number; lineTotalFils: number; vatFils: number | null };
      invoice: { subtotalFils: number | null; vatFils: number | null; totalFils: number };
    }
  | { ok: false; error: "no_line" | "no_unit_price" | "same_price" | "negative" };

export function fixUnitPrice(inv: FixInvoice, lineId: string, newUnitPriceFils: number): FixResult {
  const line = inv.lines.find((l) => l.id === lineId);
  if (!line) return { ok: false, error: "no_line" };
  if (line.unitPriceFils == null || line.unitPriceFils <= 0) return { ok: false, error: "no_unit_price" };
  if (line.unitPriceFils === newUnitPriceFils) return { ok: false, error: "same_price" };

  const before = line.quantity * line.unitPriceFils - line.discountFils;
  const after = line.quantity * newUnitPriceFils - line.discountFils;
  if (before <= 0 || after < 0) return { ok: false, error: "negative" };
  const ratio = after / before;
  const lineTotalFils = Math.round(line.lineTotalFils * ratio);
  const lineVatFils = line.vatFils == null ? null : Math.round(line.vatFils * ratio);
  const delta = lineTotalFils - line.lineTotalFils;

  // Does the printed line total already contain its VAT?
  const printed = lineNet(
    { quantity: line.quantity, unitPrice: line.unitPriceFils / 100, discount: line.discountFils / 100, vat: line.vatFils == null ? null : line.vatFils / 100, lineTotal: line.lineTotalFils / 100 },
    inv.pricesIncludeVat,
  );
  const includesVat = inv.pricesIncludeVat || Math.abs(printed.net * 100 - line.lineTotalFils) >= 1;

  let vatDelta: number;
  let totalDelta: number;
  if (includesVat) {
    vatDelta = lineVatFils != null && line.vatFils != null ? lineVatFils - line.vatFils : Math.round(delta - delta / (1 + VAT_RATE));
    totalDelta = delta;
  } else {
    vatDelta = (inv.vatFils ?? 0) > 0 ? (lineVatFils != null && line.vatFils != null ? lineVatFils - line.vatFils : Math.round(delta * VAT_RATE)) : 0;
    totalDelta = delta + vatDelta;
  }
  return {
    ok: true,
    line: { unitPriceFils: newUnitPriceFils, lineTotalFils, vatFils: lineVatFils },
    invoice: {
      subtotalFils: inv.subtotalFils == null ? null : inv.subtotalFils + (includesVat && !inv.pricesIncludeVat ? delta - vatDelta : delta),
      vatFils: inv.vatFils == null ? null : inv.vatFils + vatDelta,
      totalFils: inv.totalFils + totalDelta,
    },
  };
}
