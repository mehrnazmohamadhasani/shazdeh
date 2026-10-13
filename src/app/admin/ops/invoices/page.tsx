import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { UploadButton } from "@/components/admin/ops/upload-button";
import { DOC_STATUS } from "@/components/admin/ops/status";
import { listDocuments, parseStoredReading } from "@/lib/ops/documents";
import { formatFils, toFils } from "@/lib/ordering/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices" };

function day(d: Date) {
  return new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short", timeZone: "Asia/Dubai" }).format(d);
}

export default async function InvoicesPage() {
  const docs = await listDocuments();
  return (
    <AdminPage
      title="Invoices"
      description="Photograph a supplier invoice or receipt. AI reads it, you check it, and the stock is updated."
      actions={<UploadButton />}
    >
      <Card bodyClassName="p-0">
        {docs.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Take a photo of your next supplier invoice — any supplier, any layout, English, Arabic or Persian."
            action={<UploadButton label="Add the first invoice" />}
          />
        ) : (
          <ul className="divide-y divide-black-iron/[0.06]">
            {docs.map((d) => {
              const reading = parseStoredReading(d.extraction)?.reading;
              const supplier = d.invoice?.supplier.name ?? reading?.supplier.name ?? d.originalName ?? "Document";
              const total = d.invoice ? d.invoice.totalFils : reading?.total != null ? toFils(reading.total) : null;
              const kind = reading?.documentType;
              const status =
                d.status === "NEEDS_REVIEW" && kind === "supplier_statement"
                  ? { label: "Statement", tone: "neutral" as const }
                  : d.status === "NEEDS_REVIEW" && kind === "platform_order"
                    ? { label: "Sale — not a purchase", tone: "neutral" as const }
                    : DOC_STATUS[d.status];
              return (
                <li key={d.id}>
                  <Link
                    href={`/admin/ops/invoices/${d.id}`}
                    className="flex min-h-16 items-center gap-4 px-5 py-3 transition-colors hover:bg-black-iron/[0.02] md:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium text-black-iron">{supplier}</p>
                      <p className="mt-0.5 text-[12.5px] text-dark-grey">
                        {d.invoice ? `Invoice ${day(d.invoice.invoiceDate)}` : `Uploaded ${day(d.createdAt)}`}
                        {d.status === "FAILED" && d.error ? ` · ${d.error.slice(0, 60)}` : ""}
                      </p>
                    </div>
                    {total != null && <span className="shrink-0 text-[14px] tabular-nums">{formatFils(total)}</span>}
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    <ChevronRight className="h-4 w-4 shrink-0 text-dark-grey" />
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
