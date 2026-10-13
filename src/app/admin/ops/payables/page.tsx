import Link from "next/link";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { MarkPaidButton } from "@/components/admin/ops/document-actions";
import { day } from "@/components/admin/ops/format";
import { listPayables } from "@/lib/ops/catalog";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Payables") };
}

export default async function PayablesPage() {
  const { t, money, intl } = await getAdminI18n();
  const { open, recent } = await listPayables();
  const now = new Date();
  const owed = open.reduce((s, i) => s + i.totalFils, 0);
  const overdue = open.filter((i) => i.dueDate && i.dueDate < now);
  const invoiceLabel = (invoiceNo: string | null) => (invoiceNo ? `#${invoiceNo}` : t("Invoice"));
  return (
    <AdminPage title={t("Payables")} description={t("Credit invoices waiting to be paid, oldest due date first.")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-[12.5px] text-dark-grey">{t("Owed to suppliers")}</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums">{money(owed)}</p>
        </Card>
        <Card>
          <p className="text-[12.5px] text-dark-grey">{t("Overdue")}</p>
          <p className={`mt-1 text-[24px] font-bold tabular-nums ${overdue.length ? "text-pomegranate-red" : ""}`}>
            {money(overdue.reduce((s, i) => s + i.totalFils, 0))}
            <span className="ms-2 text-[14px] font-normal text-dark-grey">
              {t(overdue.length === 1 ? "{n} invoice" : "{n} invoices", { n: overdue.length })}
            </span>
          </p>
        </Card>
      </div>

      <Card title={t("To pay")} bodyClassName="p-0">
        {open.length === 0 ? (
          <EmptyState title={t("Nothing owed")} description={t("Invoices saved as “Credit (pay later)” appear here until they're marked paid.")} />
        ) : (
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {open.map((inv) => {
              const late = inv.dueDate && inv.dueDate < now;
              return (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3 md:px-6">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/ops/suppliers/${inv.supplier.id}`} dir="auto" className="font-medium hover:underline">
                      {inv.supplier.name}
                    </Link>
                    <p className="text-[12.5px] text-dark-grey">
                      {inv.documentId ? (
                        <Link href={`/admin/ops/invoices/${inv.documentId}`} className="hover:underline">
                          {invoiceLabel(inv.invoiceNo)} · {day(inv.invoiceDate, false, intl)}
                        </Link>
                      ) : (
                        `${invoiceLabel(inv.invoiceNo)} · ${day(inv.invoiceDate, false, intl)}`
                      )}
                    </p>
                  </div>
                  <StatusPill tone={late ? "bad" : "warn"}>
                    {inv.dueDate
                      ? t(late ? "Overdue {date}" : "Due {date}", { date: day(inv.dueDate, false, intl) })
                      : t("No due date")}
                  </StatusPill>
                  <span className="w-24 text-end font-semibold tabular-nums">{money(inv.totalFils)}</span>
                  <MarkPaidButton invoiceId={inv.id} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {recent.length > 0 && (
        <Card title={t("Recently paid")} bodyClassName="p-0">
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {recent.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-5 py-3 text-dark-grey md:px-6">
                <span className="min-w-0 flex-1 truncate">
                  <span dir="auto" className="text-black-iron">{inv.supplier.name}</span> {inv.invoiceNo ? `#${inv.invoiceNo}` : ""}
                </span>
                <span className="shrink-0">
                  {day(inv.paidAt!, false, intl)}
                  {inv.paidBy ? (
                    <>
                      {" · "}
                      <span dir="auto">{inv.paidBy}</span>
                    </>
                  ) : null}
                </span>
                <span className="w-24 shrink-0 text-end tabular-nums">{money(inv.totalFils)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AdminPage>
  );
}
