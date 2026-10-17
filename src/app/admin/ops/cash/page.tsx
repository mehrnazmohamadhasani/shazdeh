import Link from "next/link";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { PayBackButton, VoidWithdrawalButton, WithdrawalForm } from "@/components/admin/ops/purchasing-forms";
import { day } from "@/components/admin/ops/format";
import { ownerCash } from "@/lib/ops/cash";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Owner cash") };
}

export default async function OwnerCashPage() {
  const { t, money, intl, date } = await getAdminI18n();
  const monthName = (m: string) => date(new Date(`${m}-15T12:00:00+04:00`), { month: "long", year: "numeric" });
  const { people, withdrawals, invoices } = await ownerCash();
  return (
    <AdminPage
      title={t("Owner cash")}
      description={t(
        "Invoices paid with someone's own money, against cash they took from the business account (or were paid back). Set “Their own” in an invoice's Payment box; the name must match.",
      )}
    >
      <Card title={t("Balance by person")} bodyClassName="p-0">
        {people.length === 0 ? (
          <EmptyState
            title={t("Nothing yet")}
            description={t("When someone pays an invoice with their own money, open its Payment box and choose “Their own”.")}
          />
        ) : (
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {people.map((p) => (
              <li key={p.person} className="px-5 py-3 md:px-6">
                <div className="flex flex-wrap items-center gap-3">
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
                  {p.balanceFils < 0 && <PayBackButton person={p.person} amountFils={-p.balanceFils} />}
                </div>
                {p.months.length > 0 && (
                  // Month by month: what was owed at the end of each month.
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-[13px]">
                      <thead>
                        <tr className="text-start text-[12px] text-dark-grey">
                          <th className="py-1 text-start font-medium">{t("Month")}</th>
                          <th className="py-1 text-end font-medium">{t("Paid with own money")}</th>
                          <th className="py-1 text-end font-medium">{t("Taken / paid back")}</th>
                          <th className="py-1 text-end font-medium">{t("At month end")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black-iron/[0.05]">
                        {p.months.map((m) => (
                          <tr key={m.month}>
                            <td className="py-1.5">{monthName(m.month)}</td>
                            <td className="py-1.5 text-end tabular-nums">{money(m.presentedFils)}</td>
                            <td className="py-1.5 text-end tabular-nums">{money(m.withdrawnFils)}</td>
                            <td className="py-1.5 text-end tabular-nums">
                              {m.endBalanceFils < 0 ? (
                                <span className="font-medium text-terracotta-ink">{t("Business owes {amount}", { amount: money(-m.endBalanceFils) })}</span>
                              ) : m.endBalanceFils > 0 ? (
                                t("{amount} still needs invoices", { amount: money(m.endBalanceFils) })
                              ) : (
                                t("Settled")
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("Money taken or paid back")}>
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

        <Card title={t("Invoices paid with own money")} bodyClassName="p-0">
          {invoices.length === 0 ? (
            <EmptyState title={t("No invoices paid with own money yet")} />
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
                      {t("Paid {date}", { date: day(i.paidAt!, true, intl) })} · <span dir="auto">{i.paidBy}</span>
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
