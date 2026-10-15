/*
 * What each purchase line really costs SHĀZDEH. The restaurant is VAT
 * registered and reclaims input VAT, so food cost uses prices WITHOUT
 * VAT, after the line's share of any invoice-level discount. Invoices
 * print this in different ways:
 *
 *   SAFCO        unit 100, line total 105 (VAT included per line)
 *   Bakery       unit 5 × 20 = 100, VAT 5 added once at the bottom
 *   A to Z       lines 600.30, discount 90.78, then VAT → 535.00
 *   Shop receipt prices include VAT ("pricesIncludeVat")
 */

const VAT_RATE = 0.05;

export type CostLineInput = {
  quantity: number;
  unitPrice: number | null;
  discount: number;
  vat: number | null;
  lineTotal: number;
};

function close(a: number, b: number) {
  return Math.abs(a - b) <= Math.max(0.05, Math.abs(a) * 0.005);
}

/** Net (ex-VAT) amount and VAT of one line, in AED, before any invoice discount. */
export function lineNet(line: CostLineInput, pricesIncludeVat: boolean): { net: number; vat: number | null } {
  if (pricesIncludeVat) {
    const net = line.lineTotal / (1 + VAT_RATE);
    return { net, vat: line.lineTotal - net };
  }
  if (line.unitPrice != null) {
    const gross = line.quantity * line.unitPrice - Math.abs(line.discount);
    const includesVat = close(line.lineTotal, gross * (1 + VAT_RATE)) || (line.vat != null && line.vat > 0 && close(line.lineTotal, gross + line.vat));
    if (includesVat && !close(line.lineTotal, gross)) return { net: gross, vat: line.lineTotal - gross };
  }
  return { net: line.lineTotal, vat: line.vat != null && line.vat < line.lineTotal * 0.2 ? line.vat : null };
}

/**
 * Net cost of every line in fils, with an invoice-level discount spread in
 * proportion to each line's net amount. Rounding remainders go to the
 * largest line so the lines still add up exactly.
 */
export function costLines(lines: CostLineInput[], opts: { pricesIncludeVat: boolean; discount: number }) {
  const parts = lines.map((l) => lineNet(l, opts.pricesIncludeVat));
  const netSum = parts.reduce((s, p) => s + p.net, 0);
  const discount = Math.min(Math.abs(opts.discount), Math.max(netSum, 0));
  const netFils = parts.map((p) => Math.round((netSum > 0 ? p.net - (p.net / netSum) * discount : p.net) * 100));
  const target = Math.round((netSum - discount) * 100);
  const drift = target - netFils.reduce((s, n) => s + n, 0);
  if (drift !== 0 && netFils.length) {
    const largest = netFils.indexOf(Math.max(...netFils));
    netFils[largest] += drift;
  }
  return parts.map((p, i) => ({ netFils: netFils[i], vatFils: p.vat == null ? null : Math.round(p.vat * 100) }));
}

/**
 * Each line's cost WITH its share of the invoice's VAT, in fils: the net
 * costs scaled up so they add up to what was actually paid. When the
 * printed totals don't add up (factor outside 1–1.06), assume 5 % if the
 * invoice shows VAT and none otherwise — never more than was printed.
 */
export function grossLines(netFils: number[], opts: { totalFils: number; hasVat: boolean }) {
  const netSum = netFils.reduce((s, n) => s + n, 0);
  const paid = netSum > 0 ? opts.totalFils / netSum : 0;
  const factor = paid >= 1 && paid <= 1.06 ? paid : opts.hasVat ? 1 + VAT_RATE : 1;
  const gross = netFils.map((n) => Math.round(n * factor));
  const target = Math.round(netSum * factor);
  const drift = target - gross.reduce((s, n) => s + n, 0);
  if (drift !== 0 && gross.length) {
    const largest = gross.indexOf(Math.max(...gross));
    gross[largest] += drift;
  }
  return gross;
}
