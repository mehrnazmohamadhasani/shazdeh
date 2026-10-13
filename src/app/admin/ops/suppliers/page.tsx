import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { WEEKDAY_SHORT, day } from "@/components/admin/ops/format";
import { listSuppliers } from "@/lib/ops/catalog";
import { formatFils } from "@/lib/ordering/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const suppliers = await listSuppliers();
  return (
    <AdminPage title="Suppliers" description="Added automatically from invoices. Set delivery days and payment terms here.">
      <Card bodyClassName="p-0">
        {suppliers.length === 0 ? (
          <EmptyState title="No suppliers yet" description="They appear here when you save their first invoice." />
        ) : (
          <ul className="divide-y divide-black-iron/[0.06]">
            {suppliers.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/ops/suppliers/${s.id}`} className="flex min-h-16 items-center gap-4 px-5 py-3 hover:bg-black-iron/[0.02] md:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium">{s.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-dark-grey">
                      {s.invoiceCount} invoice{s.invoiceCount === 1 ? "" : "s"}
                      {s.lastInvoice ? ` · last ${day(s.lastInvoice)}` : ""}
                      {s.deliveryDays.length ? ` · delivers ${s.deliveryDays.map((d) => WEEKDAY_SHORT[d]).join(", ")}` : ""}
                    </p>
                  </div>
                  {s.owedFils > 0 && <StatusPill tone="warn">Owed {formatFils(s.owedFils)}</StatusPill>}
                  <span className="hidden shrink-0 text-[14px] tabular-nums sm:block">{formatFils(s.spendFils)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-dark-grey" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminPage>
  );
}
