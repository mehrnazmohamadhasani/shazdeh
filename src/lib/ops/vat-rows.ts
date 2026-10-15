import { isValidTrn } from "./checks";

/*
 * Purchase (input) VAT, one row per saved invoice, for the accountant.
 * VAT is what the invoice printed; when only a VAT-inclusive total was
 * printed it is worked out from the lines' net cost and marked so.
 */

export type VatInvoice = {
  invoiceDate: Date;
  supplierName: string;
  supplierTrn: string | null;
  invoiceNo: string | null;
  paymentMode: string | null;
  pricesIncludeVat: boolean;
  vatFils: number | null;
  totalFils: number;
  linesNetFils: (number | null)[];
};

export type VatRow = {
  invoiceDate: Date;
  supplierName: string;
  supplierTrn: string | null;
  invoiceNo: string | null;
  paymentMode: string | null;
  netFils: number;
  vatFils: number;
  totalFils: number;
  vatSource: "printed" | "calculated" | "none";
  /** Things the accountant should look at before claiming the VAT. */
  check: string[];
};

export function vatRow(inv: VatInvoice): VatRow {
  let vatFils: number;
  let vatSource: VatRow["vatSource"];
  if (inv.vatFils != null && inv.vatFils > 0) {
    vatFils = inv.vatFils;
    vatSource = "printed";
  } else if (inv.linesNetFils.length && inv.linesNetFils.every((n) => n != null)) {
    const net = inv.linesNetFils.reduce((s: number, n) => s + n!, 0);
    vatFils = Math.max(0, inv.totalFils - net);
    vatSource = vatFils > 0 ? "calculated" : "none";
  } else {
    vatFils = 0;
    vatSource = "none";
  }
  const check: string[] = [];
  if (vatFils > 0 && !inv.supplierTrn) check.push("No supplier TRN");
  else if (vatFils > 0 && inv.supplierTrn && !isValidTrn(inv.supplierTrn)) check.push("TRN not 15 digits");
  if (vatSource === "calculated") check.push("VAT not printed; calculated from the total");
  if (!inv.invoiceNo) check.push("No invoice number");
  return {
    invoiceDate: inv.invoiceDate,
    supplierName: inv.supplierName,
    supplierTrn: inv.supplierTrn,
    invoiceNo: inv.invoiceNo,
    paymentMode: inv.paymentMode,
    netFils: inv.totalFils - vatFils,
    vatFils,
    totalFils: inv.totalFils,
    vatSource,
    check,
  };
}
