import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { day, weekday } from "@/components/admin/ops/format";
import { listSuppliers } from "@/lib/ops/catalog";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Suppliers") };
}

export default async function SuppliersPage() {
  const { t, money, locale, intl } = await getAdminI18n();
  const suppliers = await listSuppliers();
  return (
    <AdminPage title={t("Suppliers")} description={t("Added automatically from invoices. Set delivery days and payment terms here.")}>
      <Card bodyClassName="p-0">
        {suppliers.length === 0 ? (
          <EmptyState title={t("No suppliers yet")} description={t("They appear here when you save their first invoice.")} />
        ) : (
          <ul className="divide-y divide-black-iron/[0.06]">
            {suppliers.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/ops/suppliers/${s.id}`} className="flex min-h-16 items-center gap-4 px-5 py-3 hover:bg-black-iron/[0.02] md:px-6">
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate text-[14.5px] font-medium">{s.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-dark-grey">
                      {t(s.invoiceCount === 1 ? "{n} invoice" : "{n} invoices", { n: s.invoiceCount })}
                      {s.lastInvoice ? ` · ${t("last {date}", { date: day(s.lastInvoice, false, intl) })}` : ""}
                      {s.deliveryDays.length
                        ? ` · ${t("delivers {days}", { days: s.deliveryDays.map((d) => weekday(d, locale)).join(locale === "fa" ? "، " : ", ") })}`
                        : ""}
                    </p>
                  </div>
                  {s.owedFils > 0 && <StatusPill tone="warn">{t("Owed {amount}", { amount: money(s.owedFils) })}</StatusPill>}
                  <span className="hidden shrink-0 text-[14px] tabular-nums sm:block">{money(s.spendFils)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminPage>
  );
}
