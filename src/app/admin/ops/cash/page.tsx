import Link from "next/link";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { VoidWithdrawalButton, WithdrawalForm } from "@/components/admin/ops/purchasing-forms";
import { day } from "@/components/admin/ops/format";
import { ownerCash } from "@/lib/ops/cash";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Owner cash") };
}

export default async function OwnerCashPage() {
  const { t, money, intl } = await getAdminI18n();
  const { people, withdrawals, invoices } = await ownerCash();
  return (
    <AdminPage
      title={t("Owner cash")}
      description={t(
        "Cash taken from the business account for purchases, against the cash and card invoices presented. Invoices count when their “Paid by” is the same name.",
      )}
    >
      <Card title={t("Balance by person")} bodyClassName="p-0">
        {people.length === 0 ? (
          <EmptyState
            title={t("Nothing yet")}
            description={t("Add a withdrawal below, and write the same name in “Paid by” when saving a cash invoice.")}
          />
        ) : (
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {people.map((p) => (
              <li key={p.person} className="flex flex-wrap items-center gap-3 px-5 py-3 md:px-6">
                <span dir="auto" className="min-w-0 flex-1 font-medium">
                  {p.person}
                </span>
                <span className="text-[12.5px] text-dark-grey">
                  {t("Taken {taken} · invoices {presented}", { taken: money(p.withdrawnFils), presented: money(p.presentedFils) })}
                </span>
                {p.balanceFils > 0 ? (
                  <StatusPill tone="warn">{t("{amount} still needs invoices", { amount: money(p.balanceFils) })}</StatusPill>
                ) : p.balanceFils < 0 ? (
                  <StatusPill tone="accent">{t("Business owes {amount}", { amount: money(-p.balanceFils) })}</StatusPill>
                ) : (
                  <StatusPill tone="good">{t("Settled")}</StatusPill>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("Add a withdrawal")}>
        <WithdrawalForm people={people.map((p) => p.person)} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("Withdrawals")} bodyClassName="p-0">
          {withdrawals.length === 0 ? (
            <EmptyState title={t("No withdrawals yet")} />
          ) : (
            <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
              {withdrawals.map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-5 py-3 md:px-6">
                  <span className="min-w-0 flex-1">
                    <span dir="auto" className="font-medium">
                      {w.person}
                    </span>
                    <span className="block text-[12.5px] text-dark-grey">
                      {day(w.at, true, intl)}
                      {w.note ? (
                        <>
                          {" · "}
                          <span dir="auto">{w.note}</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{money(w.amountFils)}</span>
                  <VoidWithdrawalButton id={w.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("Invoices presented")} bodyClassName="p-0">
          {invoices.length === 0 ? (
            <EmptyState title={t("No cash or card invoices with “Paid by” yet")} />
          ) : (
            <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3 md:px-6">
                  <span className="min-w-0 flex-1">
                    {i.documentId ? (
                      <Link href={`/admin/ops/invoices/${i.documentId}`} dir="auto" className="font-medium hover:underline">
                        {i.supplier.name}
                      </Link>
                    ) : (
                      <span dir="auto" className="font-medium">
                        {i.supplier.name}
                      </span>
                    )}
                    <span className="block text-[12.5px] text-dark-grey">
                      {i.invoiceNo ? `#${i.invoiceNo} · ` : ""}
                      {day(i.invoiceDate, true, intl)} · <span dir="auto">{i.paidBy}</span>
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{money(i.totalFils)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminPage>
  );
}
