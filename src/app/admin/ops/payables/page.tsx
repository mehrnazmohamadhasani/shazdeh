import Link from "next/link";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { MarkPaidButton } from "@/components/admin/ops/document-actions";
import { day } from "@/components/admin/ops/format";
import { listPayables } from "@/lib/ops/catalog";
import { formatFils } from "@/lib/ordering/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payables" };

export default async function PayablesPage() {
  const { open, recent } = await listPayables();
  const now = new Date();
  const owed = open.reduce((s, i) => s + i.totalFils, 0);
  const overdue = open.filter((i) => i.dueDate && i.dueDate < now);
  return (
    <AdminPage title="Payables" description="Credit invoices waiting to be paid, oldest due date first.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-[12.5px] text-dark-grey">Owed to suppliers</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums">{formatFils(owed)}</p>
        </Card>
        <Card>
          <p className="text-[12.5px] text-dark-grey">Overdue</p>
          <p className={`mt-1 text-[24px] font-bold tabular-nums ${overdue.length ? "text-pomegranate-red" : ""}`}>
            {formatFils(overdue.reduce((s, i) => s + i.totalFils, 0))}
            <span className="ml-2 text-[14px] font-normal text-dark-grey">{overdue.length} invoice{overdue.length === 1 ? "" : "s"}</span>
          </p>
        </Card>
      </div>

      <Card title="To pay" bodyClassName="p-0">
        {open.length === 0 ? (
          <EmptyState title="Nothing owed" description="Invoices saved as “Credit (pay later)” appear here until they're marked paid." />
        ) : (
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {open.map((inv) => {
              const late = inv.dueDate && inv.dueDate < now;
              return (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3 md:px-6">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/ops/suppliers/${inv.supplier.id}`} className="font-medium hover:underline">
                      {inv.supplier.name}
                    </Link>
                    <p className="text-[12.5px] text-dark-grey">
                      {inv.documentId ? (
                        <Link href={`/admin/ops/invoices/${inv.documentId}`} className="hover:underline">
                          {inv.invoiceNo ? `#${inv.invoiceNo}` : "Invoice"} · {day(inv.invoiceDate)}
                        </Link>
                      ) : (
                        `${inv.invoiceNo ? `#${inv.invoiceNo}` : "Invoice"} · ${day(inv.invoiceDate)}`
                      )}
                    </p>
                  </div>
                  <StatusPill tone={late ? "bad" : "warn"}>{inv.dueDate ? `${late ? "Overdue" : "Due"} ${day(inv.dueDate)}` : "No due date"}</StatusPill>
                  <span className="w-24 text-right font-semibold tabular-nums">{formatFils(inv.totalFils)}</span>
                  <MarkPaidButton invoiceId={inv.id} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {recent.length > 0 && (
        <Card title="Recently paid" bodyClassName="p-0">
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {recent.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-5 py-3 text-dark-grey md:px-6">
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-black-iron">{inv.supplier.name}</span> {inv.invoiceNo ? `#${inv.invoiceNo}` : ""}
                </span>
                <span className="shrink-0">
                  {day(inv.paidAt!)}
                  {inv.paidBy ? ` · ${inv.paidBy}` : ""}
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums">{formatFils(inv.totalFils)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AdminPage>
  );
}
