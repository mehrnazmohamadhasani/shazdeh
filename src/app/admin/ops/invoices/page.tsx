import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { UploadButton } from "@/components/admin/ops/upload-button";
import { DOC_STATUS } from "@/components/admin/ops/status";
import { listDocuments, parseStoredReading } from "@/lib/ops/documents";
import { parseStoredPlatform } from "@/lib/ops/platform-import";
import { prisma } from "@/lib/prisma";
import { toFils } from "@/lib/ordering/money";
import { day } from "@/components/admin/ops/format";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Invoices") };
}

export default async function InvoicesPage() {
  const { t, money, intl } = await getAdminI18n();
  const [docs, receipts] = await Promise.all([
    listDocuments(),
    // Platform receipts waiting to be checked — the purchaser's way in, as they don't see Sales.
    prisma.opsDocument.findMany({
      where: { kind: "platform_order", status: { in: ["PROCESSING", "NEEDS_REVIEW", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, extraction: true },
    }),
  ]);
  return (
    <AdminPage
      title={t("Invoices")}
      description={t("Photograph a supplier invoice or receipt. AI reads it, you check it, and the stock is updated.")}
      actions={
        <>
          <UploadButton kind="platform_order" variant="outline" label={t("Add platform receipt")} />
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
                      <span className="block text-[12.5px] text-dark-grey">{t("Uploaded {date}", { date: day(d.createdAt, false, intl) })}</span>
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
      <Card bodyClassName="p-0">
        {docs.length === 0 ? (
          <EmptyState
            title={t("No invoices yet")}
            description={t("Take a photo of your next supplier invoice — any supplier, any layout, English, Arabic or Persian.")}
            action={<UploadButton label={t("Add the first invoice")} />}
          />
        ) : (
          <ul className="divide-y divide-black-iron/[0.06]">
            {docs.map((d) => {
              const reading = parseStoredReading(d.extraction)?.reading;
              const supplier = d.invoice?.supplier.name ?? reading?.supplier.name ?? d.originalName ?? t("Document");
              const total = d.invoice ? d.invoice.totalFils : reading?.total != null ? toFils(reading.total) : null;
              const kind = reading?.documentType;
              const status =
                d.status === "NEEDS_REVIEW" && kind === "supplier_statement"
                  ? { label: "Statement", tone: "neutral" as const }
                  : d.status === "NEEDS_REVIEW" && kind === "platform_order"
                    ? { label: "Sale — not a purchase", tone: "neutral" as const }
                    : d.status === "SAVED" && d.autoSaved
                      ? { label: "Saved automatically", tone: "good" as const }
                      : DOC_STATUS[d.status];
              return (
                <li key={d.id}>
                  <Link
                    href={`/admin/ops/invoices/${d.id}`}
                    className="flex min-h-16 items-center gap-4 px-5 py-3 transition-colors hover:bg-black-iron/[0.02] md:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p dir="auto" className="truncate text-[14.5px] font-medium text-black-iron">{supplier}</p>
                      <p className="mt-0.5 text-[12.5px] text-dark-grey">
                        {d.invoice
                          ? t("Invoice {date}", { date: day(d.invoice.invoiceDate, false, intl) })
                          : t("Uploaded {date}", { date: day(d.createdAt, false, intl) })}
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
        )}
      </Card>
    </AdminPage>
  );
}
