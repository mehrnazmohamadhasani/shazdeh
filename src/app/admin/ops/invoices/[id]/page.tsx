/* eslint-disable @next/next/no-img-element -- private document served by an authenticated route, not next/image */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, ExternalLink, Paperclip, Phone } from "lucide-react";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { DOC_STATUS } from "@/components/admin/ops/status";
import { InvoiceReview } from "@/components/admin/ops/invoice-review";
import { DiscardButton, EditInvoiceButton, InvoicePayment, RetryRead, type PaymentMethod } from "@/components/admin/ops/document-actions";
import { RECEIPT_LABEL, type ReceiptKind } from "@/components/admin/ops/payment-labels";
import { ReadAsSaleButton } from "@/components/admin/ops/platform-forms";
import { EDIT_REASON, MANUAL_MIME, getDocument, parseStoredReading } from "@/lib/ops/documents";
import { reconcileStatement } from "@/lib/ops/catalog";
import { listMeatKinds } from "@/lib/ops/meat";
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

  const manual = doc.mimeType === MANUAL_MIME;
  // A typed-in invoice has no photo: the form gets the whole page.
  const original = manual ? null : (
    <Card
      title={t("Original")}
      actions={
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-terracotta-ink admin-link">
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
    body = (
      <div className="space-y-5">
        <Card
          title={
            <Link href={`/admin/ops/suppliers/${inv.supplierId}`} dir="auto" className="admin-link">
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
                        <Link href={`/admin/ops/ingredients/${l.ingredientId}`} dir="auto" className="underline-offset-2 admin-link">
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

        <Card title={t("Supplier")}>
          <div className="space-y-1.5 text-[14px]">
            <Link href={`/admin/ops/suppliers/${inv.supplierId}`} dir="auto" className="font-medium admin-link">
              {inv.supplier.name}
            </Link>
            {inv.supplier.phone ? (
              <p>
                <a href={`tel:${inv.supplier.phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="inline-flex items-center gap-1.5 text-terracotta-ink admin-link">
                  <Phone className="h-3.5 w-3.5" /> {inv.supplier.phone}
                </a>
              </p>
            ) : (
              <p className="text-dark-grey">{t("No phone saved")}</p>
            )}
            {inv.supplier.trn && <p className="text-dark-grey">{t("TRN {trn}", { trn: inv.supplier.trn })}</p>}
            {inv.supplier.paymentTermsDays != null && <p className="text-dark-grey">{t("Pays within {n} days", { n: inv.supplier.paymentTermsDays })}</p>}
          </div>
        </Card>

        <Card title={t("Payment")}>
          <div className="space-y-2 text-[14px]">
            <p className="text-dark-grey">
              {inv.paidAt
                ? `${t("Paid {date}", { date: date(inv.paidAt) })}${inv.paidBy ? ` · ${t("by {name}", { name: inv.paidBy })}` : ""}`
                : inv.paymentMode
                  ? t("Not paid yet")
                  : t("Payment not recorded.")}
            </p>
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
          {inv.paidAt && inv.paidPersonally && inv.paidBy && (
            <p className="mt-2 text-[13px] text-dark-grey">
              {t("Paid with {name}'s own money — the business owes it back.", { name: inv.paidBy })}{" "}
              <Link href="/admin/ops/cash" className="font-medium text-terracotta-ink admin-link">
                {t("Owner cash")}
              </Link>
            </p>
          )}
          {inv.paymentReceiptId && (
            <a
              href={`/api/admin/ops/documents/${inv.paymentReceiptId}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-terracotta-ink admin-link"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {t(RECEIPT_LABEL[(inv.paymentReceiptKind as ReceiptKind | null) ?? "card"])}
            </a>
          )}
          {inv.paymentNote && (
            <p dir="auto" className="mt-1 text-[13px] text-dark-grey">
              {inv.paymentNote}
            </p>
          )}
        </Card>

        <Link href="/admin/ops/stock" className="inline-block text-[13px] font-medium text-terracotta-ink admin-link">
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
                  r.match.documentId ? (
                    <Link href={`/admin/ops/invoices/${r.match.documentId}`} className="inline-flex min-h-10 items-center rounded-full">
                      <StatusPill tone={r.how === "number" ? "good" : "warn"}>
                        {r.how === "number" ? t("Saved") : t("Saved as #{number}", { number: r.match.invoiceNo ?? "—" })}
                        <ChevronRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
                      </StatusPill>
                    </Link>
                  ) : (
                    <StatusPill tone={r.how === "number" ? "good" : "warn"}>
                      {r.how === "number" ? t("Saved") : t("Saved as #{number}", { number: r.match.invoiceNo ?? "—" })}
                    </StatusPill>
                  )
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
    const [suppliers, ingredients, meatTypes] = await Promise.all([
      prisma.supplier.findMany({ select: { id: true, name: true, trn: true, phone: true, paymentTermsDays: true }, orderBy: { name: "asc" } }),
      prisma.ingredient.findMany({ select: { id: true, name: true, nameFa: true, unit: true, meatTypeId: true }, orderBy: { name: "asc" } }),
      listMeatKinds(),
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
          meatTypes={meatTypes}
          manual={manual}
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
          <Link href="/admin/ops/invoices" aria-label={t("Back to invoices")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black-iron/[0.04] transition-colors hover:bg-black-iron/[0.08]">
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          <span dir="auto">{stored?.reading.supplier.name ?? doc.invoice?.supplier.name ?? (manual ? t("New invoice") : t("Invoice"))}</span>
          <StatusPill tone={status.tone}>{t(status.label)}</StatusPill>
          {doc.status === "SAVED" && doc.autoSaved && <StatusPill tone="accent">{t("Saved automatically")}</StatusPill>}
        </span>
      }
      className="max-w-[1400px]"
    >
      {original ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <div className="lg:sticky lg:top-6">{original}</div>
          <div className="min-w-0">{body}</div>
        </div>
      ) : (
        body
      )}
    </AdminPage>
  );
}
