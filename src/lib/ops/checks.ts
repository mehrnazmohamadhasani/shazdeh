import type { Extraction } from "./extraction";

/*
 * Arithmetic and sanity checks on a read document. The AI copies
 * numbers; code checks they add up. Anything that doesn't is flagged
 * for the person reviewing — never silently corrected.
 */

export type Flag = {
  level: "error" | "warn" | "info";
  /** "total", "supplier", or "line:3" (0-based) */
  field: string;
  message: string;
};

const VAT_RATE = 0.05;
const LOW_CONFIDENCE = 0.7;

function close(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance;
}

const money = (v: number) => v.toFixed(2);

/** UAE TRN: 15 digits (most start 100, but suppliers print others, e.g. 104…). */
export function isValidTrn(trn: string): boolean {
  return /^1\d{14}$/.test(trn.replace(/[\s-]/g, ""));
}

export function checkExtraction(x: Extraction): Flag[] {
  const flags: Flag[] = [];

  if (x.documentType === "platform_order") {
    flags.push({ level: "error", field: "document", message: "This is a delivery-platform order (a sale), not a purchase — don't save it as an invoice." });
  }
  if (x.invoiceDate) {
    const days = (Date.parse(x.invoiceDate) - Date.now()) / 86_400_000;
    if (days > 1) flags.push({ level: "warn", field: "invoiceDate", message: `The date ${x.invoiceDate} is in the future — check it.` });
    else if (days < -365) flags.push({ level: "warn", field: "invoiceDate", message: `The date ${x.invoiceDate} is over a year ago — check it.` });
  }
  if (x.documentType === "supplier_statement") {
    flags.push({ level: "info", field: "document", message: "A statement of account — compared with saved invoices, not saved itself." });
  }
  if (x.total == null) flags.push({ level: "error", field: "total", message: "No total could be read." });
  if (!x.supplier.name) flags.push({ level: "warn", field: "supplier", message: "No supplier name — choose or add one." });
  if (!x.invoiceDate) flags.push({ level: "warn", field: "invoiceDate", message: "No date could be read." });
  if (x.supplier.trn && !isValidTrn(x.supplier.trn)) {
    flags.push({ level: "warn", field: "supplier", message: `TRN "${x.supplier.trn}" is not 15 digits — check it.` });
  }
  if (x.handwritten) flags.push({ level: "info", field: "document", message: "Handwritten — check every number." });
  if (x.documentType === "card_slip" && x.lines.length === 0) {
    flags.push({ level: "warn", field: "lines", message: "Only a card slip: there are no item lines, so nothing can go into stock." });
  }

  x.lines.forEach((l, i) => {
    const field = `line:${i}`;
    if (l.lineTotal == null) {
      flags.push({ level: "error", field, message: "No line total." });
    } else if (l.quantity != null && l.unitPrice != null) {
      const expected = l.quantity * l.unitPrice - Math.abs(l.discount ?? 0);
      const tolerance = Math.max(0.05, Math.abs(expected) * 0.005);
      // The line total may include VAT; the read VAT may be the amount or (wrongly) the rate.
      const candidates = [expected, expected * (1 + VAT_RATE), ...(l.vat != null ? [expected + l.vat] : [])];
      if (!candidates.some((c) => close(c, l.lineTotal!, tolerance))) {
        flags.push({
          level: "error",
          field,
          message: `${l.quantity} × ${money(l.unitPrice)} = ${money(expected)}, but the line says ${money(l.lineTotal)}.`,
        });
      }
    }
    if (l.confidence < LOW_CONFIDENCE) {
      flags.push({ level: "warn", field, message: l.note ? `Unsure: ${l.note}` : "Hard to read — please check." });
    }
    if (x.documentType !== "supplier_statement" && (l.category === "smallwares" || l.category === "other")) {
      flags.push({ level: "info", field, message: "Not an ingredient — won't count in food cost or stock." });
    }
  });

  // Totals: lines → subtotal → total.
  const lineSum = x.lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);
  const tolerance = 0.05 + x.lines.length * 0.01;
  const hasAllLineTotals = x.lines.length > 0 && x.lines.every((l) => l.lineTotal != null);

  // Many invoices print each line's total including VAT (SAFCO: 100 + 5 = 105),
  // so the lines add up to subtotal + VAT rather than the subtotal.
  const linesIncludeVat = x.subtotal != null && x.vat != null && close(lineSum, x.subtotal + x.vat, tolerance);
  if (hasAllLineTotals && x.subtotal != null && !linesIncludeVat && !close(lineSum, x.subtotal, tolerance)) {
    flags.push({
      level: "error",
      field: "subtotal",
      message: `Lines add up to ${money(lineSum)}, but the subtotal says ${money(x.subtotal)}.`,
    });
  }
  if (x.total != null) {
    const base = x.subtotal ?? (hasAllLineTotals ? lineSum : null);
    if (base != null) {
      // Some documents print the discount as negative ("-16.00").
      const discount = Math.abs(x.discount ?? 0);
      const candidates = [base - discount + (x.vat ?? 0), base - discount, (base - discount) * (1 + VAT_RATE)];
      if (!candidates.some((c) => close(c, x.total!, tolerance))) {
        flags.push({
          level: "error",
          field: "total",
          message: `${x.subtotal != null ? "Subtotal" : "Lines"} ${money(base)}${discount ? ` − discount ${money(discount)}` : ""}${x.vat ? ` + VAT ${money(x.vat)}` : ""} doesn't match the total ${money(x.total)}.`,
        });
      }
    }
  }

  return flags;
}

export function hasErrors(flags: Flag[]) {
  return flags.some((f) => f.level === "error");
}
