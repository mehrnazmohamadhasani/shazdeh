/* eslint-disable @next/next/no-img-element -- private document served by an authenticated route, not next/image */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { DOC_STATUS } from "@/components/admin/ops/status";
import { InvoiceReview } from "@/components/admin/ops/invoice-review";
import { DiscardButton, EditInvoiceButton, MarkPaidButton, RetryRead } from "@/components/admin/ops/document-actions";
import { ReadAsSaleButton } from "@/components/admin/ops/platform-forms";
import { EDIT_REASON, getDocument, parseStoredReading } from "@/lib/ops/documents";
import { reconcileStatement } from "@/lib/ops/catalog";
import { toFils } from "@/lib/ordering/money";
import { prisma } from "@/lib/prisma";
import { UNIT, amountText, day } from "@/components/admin/ops/format";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Invoice") };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, money, intl, locale } = await getAdminI18n();
  // Recording payments is for the money pages' users, not the purchaser.
  const canPay = (await requireAdmin()).role !== "PURCHASER";
  const date = (d: Date) => day(d, true, intl);
  const doc = await getDocument(id);
  if (!doc) notFound();
  if (doc.kind === "platform_order") redirect(`/admin/ops/sales/receipts/${doc.id}`);
  const stored = parseStoredReading(doc.extraction);
  const fileUrl = `/api/admin/ops/documents/${doc.id}/file`;
  const status = DOC_STATUS[doc.status];

  const original = (
    <Card
      title={t("Original")}
      actions={
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-terracotta-ink underline-offset-4 hover:underline">
          {t("Full size")} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      }
      bodyClassName="p-3"
    >
      {doc.mimeType === "application/pdf" ? (
        <object data={fileUrl} type="application/pdf" className="h-[45vh] w-full rounded-[10px] lg:h-[70vh]">
          <a href={fileUrl}>{t("Open the PDF")}</a>
        </object>
      ) : (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
          {/* Phones: keep the form in reach — tap for full size. */}
          <img src={fileUrl} alt={t("Uploaded invoice")} className="max-h-[40vh] w-full rounded-[10px] object-contain lg:max-h-none" />
        </a>
      )}
      <p className="mt-2 px-1 text-[12px] text-dark-grey">
        {doc.uploadedBy
          ? t("Uploaded {date} by {name}", { date: date(doc.createdAt), name: doc.uploadedBy.name ?? doc.uploadedBy.email })
          : t("Uploaded {date}", { date: date(doc.createdAt) })}
        {doc.aiModel ? ` · ${t("read by {model}", { model: doc.aiModel })}` : ""}
      </p>
    </Card>
  );

  let body: React.ReactNode;
  if (doc.status === "SAVED" && doc.invoice) {
    const inv = doc.invoice;
    const netTotal = inv.lines.reduce((sum, l) => sum + (l.netFils ?? 0), 0);
    const overdue = !inv.paidAt && inv.dueDate && inv.dueDate < new Date();
    body = (
      <div className="space-y-5">
        <Card
          title={
            <Link href={`/admin/ops/suppliers/${inv.supplierId}`} dir="auto" className="hover:underline">
              {inv.supplier.name}
            </Link>
          }
          description={
            inv.invoiceNo
              ? t("Invoice {number} · {date}", { number: inv.invoiceNo, date: date(inv.invoiceDate) })
              : date(inv.invoiceDate)
          }
          actions={<EditInvoiceButton invoiceId={inv.id} />}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {inv.lines.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-4 px-5 py-3 md:px-6">
                <div className="min-w-0">
                  <p dir="auto" className="font-medium">{l.rawName}</p>
                  <p className="text-[12.5px] text-dark-grey">
                    {l.quantity} {l.unit ?? ""}
                    {l.ingredient && l.baseQty ? (
                      <>
                        {" → +"}
                        {amountText(l.baseQty, UNIT[l.ingredient.unit], locale)}{" "}
                        <Link href={`/admin/ops/ingredients/${l.ingredientId}`} dir="auto" className="underline-offset-2 hover:underline">
                          {l.ingredient.name}
                        </Link>
                      </>
                    ) : (
                      ` · ${t(l.category.toLowerCase())}`
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-end tabular-nums">
                  <p>{money(l.lineTotalFils)}</p>
                  {l.netFils != null && l.netFils !== l.lineTotalFils && <p className="text-[12px] text-dark-grey">{t("{amount} ex VAT", { amount: money(l.netFils) })}</p>}
                </div>
              </li>
            ))}
            <li className="flex justify-between px-5 py-3 font-semibold md:px-6">
              <span>{t("Total")}</span>
              <span className="text-end tabular-nums">
                {money(inv.totalFils)}
                {netTotal > 0 && netTotal !== inv.totalFils && <span className="block text-[12px] font-normal text-dark-grey">{t("{amount} cost ex VAT", { amount: money(netTotal) })}</span>}
              </span>
            </li>
          </ul>
          {inv.notes && <p className="border-t border-black-iron/[0.06] px-5 py-3 text-[13px] text-dark-grey md:px-6">
              {t("Notes:")} <span dir="auto">{inv.notes}</span>
            </p>}
        </Card>

        <Card title={t("Payment")}>
          {inv.paidAt ? (
            <p className="text-[14px]">
              <StatusPill tone="good">{t("Paid")}</StatusPill> <span className="ms-2">{date(inv.paidAt)}</span>
              {inv.paidBy && <span className="text-dark-grey"> · {t("by {name}", { name: inv.paidBy })}</span>}
              {inv.paymentMode && <span className="text-dark-grey"> · {t(inv.paymentMode)}</span>}
              {inv.paymentNote && <span dir="auto" className="block mt-1 text-[13px] text-dark-grey">{inv.paymentNote}</span>}
            </p>
          ) : inv.paymentMode === "credit" ? (
            <div className="space-y-3">
              <p className="text-[14px]">
                <StatusPill tone={overdue ? "bad" : "warn"}>{overdue ? t("Overdue") : t("Unpaid")}</StatusPill>
                <span className="ms-2">{inv.dueDate ? t("Due {date}", { date: date(inv.dueDate) }) : t("No due date")}</span>
              </p>
              {canPay && <MarkPaidButton invoiceId={inv.id} />}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[14px] text-dark-grey">{t("Payment not recorded.")}</p>
              {canPay && <MarkPaidButton invoiceId={inv.id} />}
            </div>
          )}
        </Card>

        <Link href="/admin/ops/stock" className="inline-block text-[13px] font-medium text-terracotta-ink underline-offset-4 hover:underline">
          {t("See stock →")}
        </Link>
      </div>
    );
  } else if (doc.status === "NEEDS_REVIEW" && stored?.reading.documentType === "supplier_statement") {
    const { reading } = stored;
    const { supplier, rows } = await reconcileStatement({
      supplierName: reading.supplier.name,
      supplierId: stored.suggestions.supplierId,
      lines: reading.lines.map((l) => ({ invoiceNo: l.description, date: l.itemCode, amount: l.lineTotal })),
    });
    const missing = rows.filter((r) => !r.match);
    const missingFils = missing.reduce((s, r) => s + (r.amountFils ?? 0), 0);
    body = (
      <div className="space-y-5">
        <Card
          title={t("Statement from {name}", { name: supplier?.name ?? reading.supplier.name ?? t("a supplier") })}
          description={t("{summary}. Compared with the invoices saved here.", {
            summary: `${t(rows.length === 1 ? "{n} invoice" : "{n} invoices", { n: rows.length })}${
              reading.total != null ? ` · ${t("total {amount}", { amount: money(toFils(reading.total)) })}` : ""
            }`,
          })}
          bodyClassName="p-0"
        >
          {!supplier && (
            <p className="border-b border-black-iron/[0.06] px-5 py-3 text-[13.5px] text-cinnamon-bark md:px-6">
              {t("No saved supplier matches “{name}” yet — save one of its invoices first.", { name: reading.supplier.name ?? "" })}
            </p>
          )}
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 px-5 py-3 md:px-6">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.invoiceNo}</span>
                  {r.date && <span className="text-dark-grey"> · {date(new Date(r.date))}</span>}
                </span>
                {r.match ? (
                  <Link href={r.match.documentId ? `/admin/ops/invoices/${r.match.documentId}` : "#"} className="hover:underline">
                    <StatusPill tone={r.how === "number" ? "good" : "warn"}>
                      {r.how === "number" ? t("Saved") : t("Saved as #{number}", { number: r.match.invoiceNo ?? "—" })}
                    </StatusPill>
                  </Link>
                ) : (
                  <StatusPill tone="bad">{t("Missing")}</StatusPill>
                )}
                {r.match && !r.match.paidAt && <StatusPill tone="neutral">{t("Unpaid")}</StatusPill>}
                <span className="w-24 text-end tabular-nums">{r.amountFils != null ? money(r.amountFils) : "—"}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-black-iron/[0.06] px-5 py-3 text-[13.5px] md:px-6">
            {missing.length === 0 ? (
              <span className="text-olive-leaf">{t("Every invoice on this statement is saved.")}</span>
            ) : (
              <span className="text-pomegranate-red">
                {t("{n} missing ({amount}) — add their photos so stock and costs are complete.", {
                  n: missing.length,
                  amount: money(missingFils),
                })}
              </span>
            )}
          </p>
        </Card>
        <DiscardButton documentId={doc.id} label={t("Done — remove from the list")} />
      </div>
    );
  } else if (doc.status === "NEEDS_REVIEW" && stored?.reading.documentType === "platform_order") {
    const [saleBefore, saleAfter] = t(
      "It is a customer's order from SHĀZDEH — a {sale}, not a purchase — so it doesn't belong in invoices or stock.",
    ).split("{sale}");
    body = (
      <Card title={t("This is a {platform} order", { platform: stored.reading.supplier.name ?? t("delivery platform") })}>
        <p className="text-[14px] leading-relaxed text-dark-grey">
          {saleBefore}
          <strong className="text-black-iron">{t("sale")}</strong>
          {saleAfter}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ReadAsSaleButton documentId={doc.id} />
          <DiscardButton documentId={doc.id} />
        </div>
      </Card>
    );
  } else if (doc.status === "NEEDS_REVIEW" && stored) {
    const undone = doc.voidedInvoices[0];
    const [suppliers, ingredients] = await Promise.all([
      prisma.supplier.findMany({ select: { id: true, name: true, trn: true, phone: true, paymentTermsDays: true }, orderBy: { name: "asc" } }),
      prisma.ingredient.findMany({ select: { id: true, name: true, unit: true }, orderBy: { name: "asc" } }),
    ]);
    body = (
      <>
        {undone?.voidedAt && (
          <p className="mb-5 rounded-[16px] border border-saffron-orange/30 bg-saffron-orange/[0.08] px-4 py-3 text-[13.5px] text-cinnamon-bark">
            {undone.voidReason === EDIT_REASON
              ? t("You are editing a saved invoice. Its stock doesn't count until you save it again. To remove it completely, press Discard.")
              : undone.voidReason
              ? t("Saved before and undone on {date} — “{reason}”. Correct it and save again.", {
                  date: date(undone.voidedAt),
                  reason: undone.voidReason,
                })
              : t("Saved before and undone on {date}. Correct it and save again.", { date: date(undone.voidedAt) })}
          </p>
        )}
        <InvoiceReview
          documentId={doc.id}
          reading={stored.reading}
          suggestions={stored.suggestions}
          suppliers={suppliers}
          ingredients={ingredients.map((i) => ({ ...i, unit: UNIT[i.unit] }))}
        />
      </>
    );
  } else {
    body = (
      <Card title={doc.status === "FAILED" ? t("AI couldn't read this document") : t(status.label)}>
        {doc.error && doc.status !== "DISCARDED" && <p className="text-[14px] text-pomegranate-red">{t(doc.error)}</p>}
        {doc.status === "DISCARDED" ? (
          <>
            <p className="text-[14px] text-dark-grey">{t("This document was discarded. Nothing was saved from it.")}</p>
            <div className="mt-4">
              <RetryRead documentId={doc.id} />
            </div>
          </>
        ) : (
          <div className="mt-4">
            <RetryRead documentId={doc.id} />
          </div>
        )}
      </Card>
    );
  }

  return (
    <AdminPage
      title={
        <span className="flex flex-wrap items-center gap-3">
          <Link href="/admin/ops/invoices" aria-label={t("Back to invoices")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black-iron/[0.05]">
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          <span dir="auto">{stored?.reading.supplier.name ?? doc.invoice?.supplier.name ?? t("Invoice")}</span>
          <StatusPill tone={status.tone}>{t(status.label)}</StatusPill>
          {doc.status === "SAVED" && doc.autoSaved && <StatusPill tone="accent">{t("Saved automatically")}</StatusPill>}
        </span>
      }
      className="max-w-[1400px]"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <div className="lg:sticky lg:top-6">{original}</div>
        <div className="min-w-0">{body}</div>
      </div>
    </AdminPage>
  );
}
