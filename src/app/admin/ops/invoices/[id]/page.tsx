/* eslint-disable @next/next/no-img-element -- private document served by an authenticated route, not next/image */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { DOC_STATUS } from "@/components/admin/ops/status";
import { InvoiceReview } from "@/components/admin/ops/invoice-review";
import { DiscardButton, MarkPaidButton, RetryRead, UndoInvoiceButton } from "@/components/admin/ops/document-actions";
import { getDocument, parseStoredReading } from "@/lib/ops/documents";
import { reconcileStatement } from "@/lib/ops/catalog";
import { formatFils, toFils } from "@/lib/ordering/money";
import { formatAmount, type BaseUnit } from "@/lib/ops/units";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice" };

const UNIT: Record<string, BaseUnit> = { G: "g", ML: "ml", PCS: "pcs" };

function day(d: Date) {
  return new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(d);
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) notFound();
  const stored = parseStoredReading(doc.extraction);
  const fileUrl = `/api/admin/ops/documents/${doc.id}/file`;
  const status = DOC_STATUS[doc.status];

  const original = (
    <Card
      title="Original"
      actions={
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-terracotta-ink underline-offset-4 hover:underline">
          Full size <ExternalLink className="h-3.5 w-3.5" />
        </a>
      }
      bodyClassName="p-3"
    >
      {doc.mimeType === "application/pdf" ? (
        <object data={fileUrl} type="application/pdf" className="h-[45vh] w-full rounded-[10px] lg:h-[70vh]">
          <a href={fileUrl}>Open the PDF</a>
        </object>
      ) : (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
          {/* Phones: keep the form in reach — tap for full size. */}
          <img src={fileUrl} alt="Uploaded invoice" className="max-h-[40vh] w-full rounded-[10px] object-contain lg:max-h-none" />
        </a>
      )}
      <p className="mt-2 px-1 text-[12px] text-dark-grey">
        Uploaded {day(doc.createdAt)}
        {doc.uploadedBy ? ` by ${doc.uploadedBy.name ?? doc.uploadedBy.email}` : ""}
        {doc.aiModel ? ` · read by ${doc.aiModel}` : ""}
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
            <Link href={`/admin/ops/suppliers/${inv.supplierId}`} className="hover:underline">
              {inv.supplier.name}
            </Link>
          }
          description={`${inv.invoiceNo ? `Invoice ${inv.invoiceNo} · ` : ""}${day(inv.invoiceDate)}`}
          actions={<UndoInvoiceButton invoiceId={inv.id} />}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {inv.lines.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-4 px-5 py-3 md:px-6">
                <div className="min-w-0">
                  <p className="font-medium">{l.rawName}</p>
                  <p className="text-[12.5px] text-dark-grey">
                    {l.quantity} {l.unit ?? ""}
                    {l.ingredient && l.baseQty ? (
                      <>
                        {" → +"}
                        {formatAmount(l.baseQty, UNIT[l.ingredient.unit])}{" "}
                        <Link href={`/admin/ops/ingredients/${l.ingredientId}`} className="underline-offset-2 hover:underline">
                          {l.ingredient.name}
                        </Link>
                      </>
                    ) : (
                      ` · ${l.category.toLowerCase()}`
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p>{formatFils(l.lineTotalFils)}</p>
                  {l.netFils != null && l.netFils !== l.lineTotalFils && <p className="text-[12px] text-dark-grey">{formatFils(l.netFils)} ex VAT</p>}
                </div>
              </li>
            ))}
            <li className="flex justify-between px-5 py-3 font-semibold md:px-6">
              <span>Total</span>
              <span className="text-right tabular-nums">
                {formatFils(inv.totalFils)}
                {netTotal > 0 && netTotal !== inv.totalFils && <span className="block text-[12px] font-normal text-dark-grey">{formatFils(netTotal)} cost ex VAT</span>}
              </span>
            </li>
          </ul>
          {inv.notes && <p className="border-t border-black-iron/[0.06] px-5 py-3 text-[13px] text-dark-grey md:px-6">Notes: {inv.notes}</p>}
        </Card>

        <Card title="Payment">
          {inv.paidAt ? (
            <p className="text-[14px]">
              <StatusPill tone="good">Paid</StatusPill> <span className="ml-2">{day(inv.paidAt)}</span>
              {inv.paidBy && <span className="text-dark-grey"> · by {inv.paidBy}</span>}
              {inv.paymentMode && <span className="text-dark-grey"> · {inv.paymentMode}</span>}
              {inv.paymentNote && <span className="block mt-1 text-[13px] text-dark-grey">{inv.paymentNote}</span>}
            </p>
          ) : inv.paymentMode === "credit" ? (
            <div className="space-y-3">
              <p className="text-[14px]">
                <StatusPill tone={overdue ? "bad" : "warn"}>{overdue ? "Overdue" : "Unpaid"}</StatusPill>
                <span className="ml-2">{inv.dueDate ? `Due ${day(inv.dueDate)}` : "No due date"}</span>
              </p>
              <MarkPaidButton invoiceId={inv.id} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[14px] text-dark-grey">Payment not recorded.</p>
              <MarkPaidButton invoiceId={inv.id} />
            </div>
          )}
        </Card>

        <Link href="/admin/ops/stock" className="inline-block text-[13px] font-medium text-terracotta-ink underline-offset-4 hover:underline">
          See stock →
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
          title={`Statement from ${supplier?.name ?? reading.supplier.name ?? "a supplier"}`}
          description={`${rows.length} invoice${rows.length === 1 ? "" : "s"}${reading.total != null ? ` · total ${formatFils(toFils(reading.total))}` : ""}. Compared with the invoices saved here.`}
          bodyClassName="p-0"
        >
          {!supplier && (
            <p className="border-b border-black-iron/[0.06] px-5 py-3 text-[13.5px] text-cinnamon-bark md:px-6">
              No saved supplier matches “{reading.supplier.name}” yet — save one of its invoices first.
            </p>
          )}
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 px-5 py-3 md:px-6">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.invoiceNo}</span>
                  {r.date && <span className="text-dark-grey"> · {day(new Date(r.date))}</span>}
                </span>
                {r.match ? (
                  <Link href={r.match.documentId ? `/admin/ops/invoices/${r.match.documentId}` : "#"} className="hover:underline">
                    <StatusPill tone={r.how === "number" ? "good" : "warn"}>
                      {r.how === "number" ? "Saved" : `Saved as #${r.match.invoiceNo ?? "—"}`}
                    </StatusPill>
                  </Link>
                ) : (
                  <StatusPill tone="bad">Missing</StatusPill>
                )}
                {r.match && !r.match.paidAt && <StatusPill tone="neutral">Unpaid</StatusPill>}
                <span className="w-24 text-right tabular-nums">{r.amountFils != null ? formatFils(r.amountFils) : "—"}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-black-iron/[0.06] px-5 py-3 text-[13.5px] md:px-6">
            {missing.length === 0 ? (
              <span className="text-olive-leaf">Every invoice on this statement is saved.</span>
            ) : (
              <span className="text-pomegranate-red">
                {missing.length} missing ({formatFils(missingFils)}) — add their photos so stock and costs are complete.
              </span>
            )}
          </p>
        </Card>
        <DiscardButton documentId={doc.id} label="Done — remove from the list" />
      </div>
    );
  } else if (doc.status === "NEEDS_REVIEW" && stored?.reading.documentType === "platform_order") {
    body = (
      <Card title={`This is a ${stored.reading.supplier.name ?? "delivery platform"} order`}>
        <p className="text-[14px] leading-relaxed text-dark-grey">
          It is a customer&apos;s order from SHĀZDEH — a <strong className="text-black-iron">sale</strong>, not a purchase — so it
          doesn&apos;t belong in invoices or stock. Reading platform orders and their fees comes in the next step.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <DiscardButton documentId={doc.id} />
          <RetryRead documentId={doc.id} />
        </div>
      </Card>
    );
  } else if (doc.status === "NEEDS_REVIEW" && stored) {
    const undone = doc.voidedInvoices[0];
    const [suppliers, ingredients] = await Promise.all([
      prisma.supplier.findMany({ select: { id: true, name: true, trn: true, paymentTermsDays: true }, orderBy: { name: "asc" } }),
      prisma.ingredient.findMany({ select: { id: true, name: true, unit: true }, orderBy: { name: "asc" } }),
    ]);
    body = (
      <>
        {undone?.voidedAt && (
          <p className="mb-5 rounded-[16px] border border-saffron-orange/30 bg-saffron-orange/[0.08] px-4 py-3 text-[13.5px] text-cinnamon-bark">
            Saved before and undone on {day(undone.voidedAt)}{undone.voidReason ? ` — “${undone.voidReason}”` : ""}. Correct it and save again.
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
      <Card title={doc.status === "FAILED" ? "AI couldn't read this document" : status.label}>
        {doc.error && <p className="text-[14px] text-pomegranate-red">{doc.error}</p>}
        {doc.status === "DISCARDED" ? (
          <p className="text-[14px] text-dark-grey">This document was discarded. Nothing was saved from it.</p>
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
          <Link href="/admin/ops/invoices" aria-label="Back to invoices" className="grid h-9 w-9 place-items-center rounded-full hover:bg-black-iron/[0.05]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {stored?.reading.supplier.name ?? doc.invoice?.supplier.name ?? "Invoice"}
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
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
