import Link from "next/link";
import { ChevronRight, Phone } from "lucide-react";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { UploadButton } from "@/components/admin/ops/upload-button";
import { InvoicePayment, ManualInvoiceButton, type PaymentMethod } from "@/components/admin/ops/document-actions";
import type { ReceiptKind } from "@/components/admin/ops/payment-labels";
import { DOC_STATUS } from "@/components/admin/ops/status";
import { MANUAL_MIME, invoiceMonthCounts, listDocuments, listInvoices, parseStoredReading } from "@/lib/ops/documents";
import { monthRange } from "@/lib/ops/sales";
import { MonthPicker } from "@/components/admin/month-picker";
import { parseStoredPlatform } from "@/lib/ops/platform-import";
import { prisma } from "@/lib/prisma";
import { toFils } from "@/lib/ordering/money";
import { day } from "@/components/admin/ops/format";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** One grid for the headings and every row, so the columns line up. Phone: name | total, payment below. */
const ROW = "grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-5 md:grid-cols-[minmax(0,1fr)_8.5rem_minmax(15rem,18rem)] md:items-center md:gap-x-6 md:px-6";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Invoices") };
}

/*
 * Invoices and what is owed, on one screen (Payables was folded in here):
 * documents still to check, then every saved invoice by invoice date with
 * its supplier, total and payment — cash, card, transfer or on account,
 * paid or not — set in one tap by those who record payments.
 */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ show?: string; month?: string }> }) {
  const { t, money, intl, date } = await getAdminI18n();
  const { show, month: asked } = await searchParams;
  const unpaidOnly = show === "unpaid";
  // One Dubai month at a time (this month unless another is picked); "Not paid" covers every month.
  const thisMonth = monthRange().key;
  const { start, end, key: month } = monthRange(asked && asked <= thisMonth ? asked : null);
  const role = (await requireAdmin()).role;
  const canPay = role === "ADMIN" || role === "EDITOR";
  const [docs, receipts, invoices, unpaid, counts] = await Promise.all([
    listDocuments(),
    // Platform receipts waiting to be checked — the purchaser's way in, as they don't see Sales.
    prisma.opsDocument.findMany({
      where: { kind: "platform_order", status: { in: ["PROCESSING", "NEEDS_REVIEW", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, extraction: true },
    }),
    unpaidOnly ? listInvoices({ unpaid: true }) : listInvoices({ from: start, to: end }),
    listInvoices({ unpaid: true }),
    invoiceMonthCounts(),
  ]);
  const now = new Date();
  const owed = unpaid.reduce((s, i) => s + i.totalFils, 0);
  const overdue = unpaid.filter((i) => i.dueDate && i.dueDate < now);
  const when = (d: Date) => date(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const monthName = date(new Date(`${month}-15T12:00:00+04:00`), { month: "long", year: "numeric" });
  // Rows under one heading per Dubai day, newest first (the list is already in that order).
  const days: { key: string; date: Date; rows: typeof invoices }[] = [];
  for (const inv of invoices) {
    const key = new Date(inv.invoiceDate.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);
    const last = days.at(-1);
    if (last?.key === key) last.rows.push(inv);
    else days.push({ key, date: inv.invoiceDate, rows: [inv] });
  }
  const dayName = (d: Date) =>
    date(d, { weekday: "long", day: "numeric", month: "long", ...(unpaidOnly && d.getUTCFullYear() !== now.getUTCFullYear() ? { year: "numeric" } : {}) });

  return (
    <AdminPage
      title={t("Invoices")}
      description={t("Photograph a supplier invoice or type it in. You check it, the stock is updated, and you record how it is paid.")}
      actions={
        <>
          <UploadButton kind="platform_order" variant="outline" label={t("Add platform receipt")} />
          <ManualInvoiceButton />
          <UploadButton />
        </>
      }
    >
      {receipts.length > 0 && (
        <Card title={t("Platform receipts to check")} bodyClassName="p-0">
          <ul className="divide-y divide-black-iron/[0.06]">
            {receipts.map((d) => {
              const r = parseStoredPlatform(d.extraction);
              const status = DOC_STATUS[d.status];
              return (
                <li key={d.id}>
                  <Link href={`/admin/ops/sales/receipts/${d.id}`} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-black-iron/[0.02] md:px-6">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium">{r ? `${r.platformPrinted ?? r.platform} ${r.orderNo ? `#${r.orderNo}` : ""}` : t("Receipt")}</span>
                      <span className="block text-[12.5px] text-dark-grey">{t("Uploaded {date}", { date: when(d.createdAt) })}</span>
                    </span>
                    <StatusPill tone={status.tone}>{t(status.label)}</StatusPill>
                    <ChevronRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {docs.length > 0 && (
        <Card title={t("To check")} bodyClassName="p-0">
          <ul className="divide-y divide-black-iron/[0.06]">
            {docs.map((d) => {
              const reading = parseStoredReading(d.extraction)?.reading;
              const manual = d.mimeType === MANUAL_MIME;
              const supplier = reading?.supplier.name ?? d.originalName ?? (manual ? t("New invoice") : t("Document"));
              const total = reading?.total ? toFils(reading.total) : null;
              const kind = reading?.documentType;
              const status =
                kind === "supplier_statement" && d.status === "NEEDS_REVIEW"
                  ? { label: "Statement", tone: "neutral" as const }
                  : kind === "platform_order" && d.status === "NEEDS_REVIEW"
                    ? { label: "Sale — not a purchase", tone: "neutral" as const }
                    : DOC_STATUS[d.status];
              return (
                <li key={d.id}>
                  <Link href={`/admin/ops/invoices/${d.id}`} className="flex min-h-16 items-center gap-4 px-5 py-3 transition-colors hover:bg-black-iron/[0.02] md:px-6">
                    <div className="min-w-0 flex-1">
                      <p dir="auto" className="truncate text-[14.5px] font-medium text-black-iron">{supplier}</p>
                      <p className="mt-0.5 text-[12.5px] text-dark-grey">
                        {manual ? t("Started {date}", { date: when(d.createdAt) }) : t("Uploaded {date}", { date: when(d.createdAt) })}
                        {reading?.invoiceDate && !manual ? ` · ${t("Invoice {date}", { date: day(reading.invoiceDate, false, intl) })}` : ""}
                        {d.status === "FAILED" && d.error ? ` · ${t(d.error).slice(0, 60)}` : ""}
                      </p>
                    </div>
                    {total != null && <span className="shrink-0 text-[14px] tabular-nums">{money(total)}</span>}
                    <StatusPill tone={status.tone}>{t(status.label)}</StatusPill>
                    <ChevronRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {canPay && unpaid.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <p className="text-[12.5px] text-dark-grey">{t("Owed to suppliers")}</p>
            <p className="mt-1 text-[19px] font-bold tabular-nums sm:text-[22px]">{money(owed)}</p>
            <p className="text-[12.5px] text-dark-grey">{t(unpaid.length === 1 ? "{n} invoice" : "{n} invoices", { n: unpaid.length })}</p>
          </Card>
          <Card>
            <p className="text-[12.5px] text-dark-grey">{t("Overdue")}</p>
            <p className={cn("mt-1 text-[19px] font-bold tabular-nums sm:text-[22px]", overdue.length > 0 && "text-pomegranate-red")}>{money(overdue.reduce((s, i) => s + i.totalFils, 0))}</p>
            <p className="text-[12.5px] text-dark-grey">{t(overdue.length === 1 ? "{n} invoice" : "{n} invoices", { n: overdue.length })}</p>
          </Card>
        </div>
      )}

      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {[
              { key: "month", label: t("By month"), href: `/admin/ops/invoices${month !== thisMonth ? `?month=${month}` : ""}`, on: !unpaidOnly },
              { key: "unpaid", label: t("Not paid ({n})", { n: unpaid.length }), href: "/admin/ops/invoices?show=unpaid", on: unpaidOnly },
            ].map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={tab.on ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-medium transition-colors",
                  tab.on ? "bg-black-iron text-warm-white" : "bg-black-iron/[0.05] text-black-iron hover:bg-black-iron/[0.09]",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </span>
        }
        bodyClassName="p-0"
      >
        {!unpaidOnly && (
          // The month: arrows and a calendar of months (with how many invoices each has), and its total.
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black-iron/[0.06] px-5 py-3 md:px-6">
            <MonthPicker month={month} current={thisMonth} path="/admin/ops/invoices" arrows counts={counts} description="Pick a month to see its invoices." />
            {invoices.length > 0 && (
              <p className="text-[13px] text-dark-grey">
                {t(invoices.length === 1 ? "{n} invoice" : "{n} invoices", { n: invoices.length })} ·{" "}
                <span className="font-semibold tabular-nums text-black-iron">{money(invoices.reduce((n, i) => n + i.totalFils, 0))}</span>
              </p>
            )}
          </div>
        )}
        {invoices.length === 0 ? (
          unpaidOnly ? (
            <EmptyState title={t("Nothing owed")} description={t("Every saved invoice is paid.")} />
          ) : counts[month] || Object.keys(counts).length ? (
            <EmptyState title={t("No invoices in {month}", { month: monthName })} description={t("Use the arrows or the calendar to see another month.")} />
          ) : (
            <EmptyState
              title={t("No invoices yet")}
              description={t("Take a photo of your next supplier invoice — any supplier, any layout, English, Arabic or Persian.")}
              action={<UploadButton label={t("Add the first invoice")} />}
            />
          )
        ) : (
          <div role="table" aria-label={t("Invoices")}>
            {/* Column headings (wide screens); on a phone each row stacks. */}
            <div role="row" className={cn(ROW, "hidden border-b border-black-iron/[0.06] py-2.5 text-[12px] font-medium text-dark-grey md:grid")}>
              <span role="columnheader">{t("Supplier")}</span>
              <span role="columnheader" className="text-end">
                {t("Total")}
              </span>
              <span role="columnheader">{t("Payment")}</span>
            </div>
            {days.map((d) => (
              <div key={d.key} role="rowgroup">
                {/* One heading per day, newest day first. */}
                <div role="row" className="flex items-baseline justify-between gap-3 border-b border-black-iron/[0.06] bg-black-iron/[0.025] px-5 py-2 md:px-6">
                  <span role="rowheader" className="text-[13px] font-semibold text-black-iron">
                    {dayName(d.date)}
                  </span>
                  <span className="text-[12px] tabular-nums text-dark-grey">
                    {t(d.rows.length === 1 ? "{n} invoice" : "{n} invoices", { n: d.rows.length })} · {money(d.rows.reduce((n, i) => n + i.totalFils, 0))}
                  </span>
                </div>
                <ul className="divide-y divide-black-iron/[0.06] border-b border-black-iron/[0.06] last:border-b-0">
                  {d.rows.map((inv) => (
                    <li key={inv.id} role="row" className={cn(ROW, "relative grid cursor-pointer gap-y-2 py-3 hover:bg-black-iron/[0.03]")}>
                      <Link
                        role="cell"
                        href={inv.documentId ? `/admin/ops/invoices/${inv.documentId}` : `/admin/ops/suppliers/${inv.supplier.id}`}
                        className="row-link col-start-1 row-start-1 min-w-0 md:col-auto md:row-auto"
                      >
                        <p dir="auto" className="truncate text-[14.5px] font-medium text-black-iron">
                          {inv.supplier.name}
                        </p>
                        <p className="mt-0.5 truncate text-[12.5px] text-dark-grey">
                          {inv.invoiceNo ? <bdi dir="ltr">#{inv.invoiceNo}</bdi> : t("No invoice number")}
                          {inv.document?.autoSaved ? ` · ${t("saved automatically")}` : ""}
                        </p>
                        {inv.supplier.phone && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-dark-grey" dir="ltr">
                            <Phone className="h-3 w-3" /> {inv.supplier.phone}
                          </p>
                        )}
                      </Link>
                      <span role="cell" className="col-start-2 row-start-1 inline-flex items-center justify-end gap-2 self-start text-[15px] font-semibold tabular-nums md:col-auto md:row-auto md:self-center">
                        {money(inv.totalFils)}
                        <ChevronRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" aria-hidden />
                      </span>
                      <div role="cell" className="relative z-10 col-span-2 md:col-span-1">
                        <InvoicePayment
                          invoiceId={inv.id}
                          method={(inv.paymentMode as PaymentMethod | null) ?? null}
                          paidAt={inv.paidAt?.toISOString() ?? null}
                          paidBy={inv.paidBy}
                          personal={inv.paidPersonally}
                          receiptId={inv.paymentReceiptId}
                          receiptKind={(inv.paymentReceiptKind as ReceiptKind | null) ?? null}
                          dueDate={inv.dueDate?.toISOString() ?? null}
                          canEdit={canPay}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
