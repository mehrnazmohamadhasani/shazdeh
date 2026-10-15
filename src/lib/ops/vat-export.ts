import "server-only";
import writeExcelFile, { type SheetData } from "write-excel-file/node";
import { prisma } from "@/lib/prisma";
import { dubaiDate } from "./documents";
import { vatRow } from "./vat-rows";

const DAY_MS = 86_400_000;
const aed = (fils: number) => ({ value: fils / 100, type: Number, format: "#,##0.00" }) as const;
const bold = (value: string) => ({ value, fontWeight: "bold" as const });

/** Purchase VAT for invoices dated from–to (Dubai days, inclusive) as an .xlsx Buffer. */
export async function purchaseVatWorkbook(from: string, to: string) {
  const invoices = await prisma.purchaseInvoice.findMany({
    where: { voidedAt: null, invoiceDate: { gte: new Date(dubaiDate(from).getTime() - DAY_MS / 2), lt: new Date(dubaiDate(to).getTime() + DAY_MS / 2) } },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    include: { supplier: { select: { name: true, trn: true } }, lines: { select: { netFils: true } } },
  });
  const rows = invoices.map((i) =>
    vatRow({
      invoiceDate: i.invoiceDate,
      supplierName: i.supplier.name,
      supplierTrn: i.supplier.trn,
      invoiceNo: i.invoiceNo,
      paymentMode: i.paymentMode,
      pricesIncludeVat: i.pricesIncludeVat,
      vatFils: i.vatFils,
      totalFils: i.totalFils,
      linesNetFils: i.lines.map((l) => l.netFils),
    }),
  );

  const header = ["Date", "Supplier", "Supplier TRN", "Invoice no.", "Payment", "Net (AED)", "VAT (AED)", "Total (AED)", "VAT source", "Check"].map(bold);
  const data: SheetData = [
    header,
    ...rows.map((r) => [
      { value: r.invoiceDate, type: Date, format: "dd/mm/yyyy" },
      r.supplierName,
      r.supplierTrn ?? "",
      r.invoiceNo ?? "",
      r.paymentMode ?? "",
      aed(r.netFils),
      aed(r.vatFils),
      aed(r.totalFils),
      r.vatSource,
      r.check.join("; "),
    ]),
  ];

  const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const withVat = rows.filter((r) => r.vatFils > 0);
  const summary: SheetData = [
    [bold("SHĀZDEH — purchase (input) VAT"), ""],
    ["Period", `${from} to ${to}`],
    ["Invoices", rows.length],
    ["Invoices with VAT", withVat.length],
    ["Net (AED)", aed(sum((r) => r.netFils))],
    ["VAT (AED)", aed(sum((r) => r.vatFils))],
    ["Total (AED)", aed(sum((r) => r.totalFils))],
    ["Invoices to check", rows.filter((r) => r.check.length).length],
    ["", ""],
    ["Read from photos by AI and checked by staff. The accountant must review before filing.", ""],
  ];

  return writeExcelFile([
    { data: summary, sheet: "Summary", columns: [{ width: 28 }, { width: 24 }] },
    {
      data,
      sheet: "Purchases",
      stickyRowsCount: 1,
      columns: [{ width: 12 }, { width: 34 }, { width: 18 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 40 }],
    },
  ]).toBuffer();
}
