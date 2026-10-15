import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { UploadButton } from "@/components/admin/ops/upload-button";
import { MonthPicker } from "@/components/admin/month-picker";
import { DOC_STATUS } from "@/components/admin/ops/status";
import { day } from "@/components/admin/ops/format";
import { parseStoredPlatform } from "@/lib/ops/platform-import";
import { monthRange, salesOverview } from "@/lib/ops/sales";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Sales") };
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { t, money, intl } = await getAdminI18n();
  const { month: asked } = await searchParams;
  const { month, byChannel, orders, pending } = await salesOverview(asked);
  const totalSales = byChannel.reduce((s, c) => s + c.foodSalesFils, 0);
  const active = byChannel.filter((c) => c.orders > 0);

  return (
    <AdminPage
      title={t("Sales")}
      description={t("Website orders and delivery-platform orders. Photograph each platform receipt; AI reads it and you confirm.")}
      actions={<UploadButton kind="platform_order" label={t("Add platform receipt")} />}
    >
      {pending.length > 0 && (
        <Card title={t("Receipts to check")} bodyClassName="p-0">
          <ul className="divide-y divide-black-iron/[0.06]">
            {pending.map((d) => {
              const r = parseStoredPlatform(d.extraction);
              const status = DOC_STATUS[d.status];
              return (
                <li key={d.id}>
                  <Link href={`/admin/ops/sales/receipts/${d.id}`} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-black-iron/[0.02] md:px-6">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium">
                        {r ? `${r.platformPrinted ?? r.platform} ${r.orderNo ? `#${r.orderNo}` : ""}` : t("Receipt")}
                      </span>
                      <span className="block text-[12.5px] text-dark-grey">
                        {t("Uploaded {date}", { date: day(d.createdAt, false, intl) })}
                        {d.status === "FAILED" && d.error ? ` · ${t(d.error).slice(0, 60)}` : ""}
                      </span>
                    </span>
                    {r?.total != null && <span className="tabular-nums">{money(Math.round(r.total * 100))}</span>}
                    <StatusPill tone={status.tone}>{t(status.label)}</StatusPill>
                    <ChevronRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card
        title={<MonthPicker month={month} current={monthRange().key} path="/admin/ops/sales" />}
        description={t("Food sales are what SHĀZDEH sold, without the customer's delivery and service fees. Platform fees are estimates from each platform's fee terms.")}
        bodyClassName="p-0"
      >
        {active.length === 0 ? (
          <EmptyState title={t("No sales recorded this month")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead className="text-[12.5px] text-dark-grey">
                <tr className="border-b border-black-iron/[0.06]">
                  <th className="px-5 py-3 text-start font-medium md:px-6">{t("Channel")}</th>
                  <th className="px-3 py-3 text-end font-medium">{t("Orders")}</th>
                  <th className="px-3 py-3 text-end font-medium">{t("Food sales")}</th>
                  <th className="px-3 py-3 text-end font-medium">{t("Platform fees (est.)")}</th>
                  <th className="px-5 py-3 text-end font-medium md:px-6">{t("After fees (est.)")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black-iron/[0.06]">
                {active.map((c) => (
                  <tr key={c.code}>
                    <td className="px-5 py-3 font-medium md:px-6">{c.name}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{c.orders}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{money(c.foodSalesFils)}</td>
                    <td className="px-3 py-3 text-end tabular-nums">
                      {c.feesFils != null ? (
                        money(c.feesFils)
                      ) : (
                        <Link href="/admin/ops/channels" className="text-cinnamon-bark underline-offset-4 hover:underline">
                          {t("Unknown — add fee terms")}
                        </Link>
                      )}
                    </td>
                    <td className="px-5 py-3 text-end tabular-nums md:px-6">{c.feesFils != null ? money(c.foodSalesFils - c.feesFils) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-black-iron/[0.1] font-semibold">
                  <td className="px-5 py-3 md:px-6">{t("Total")}</td>
                  <td className="px-3 py-3 text-end tabular-nums">{active.reduce((s, c) => s + c.orders, 0)}</td>
                  <td className="px-3 py-3 text-end tabular-nums">{money(totalSales)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title={t("Platform orders")} bodyClassName="p-0">
        {orders.length === 0 ? (
          <EmptyState title={t("No platform orders this month")} description={t("Add a receipt photo to record one.")} />
        ) : (
          <ul className="divide-y divide-black-iron/[0.06]">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={o.documentId ? `/admin/ops/sales/receipts/${o.documentId}` : "#"}
                  className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-black-iron/[0.02] md:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium">
                      {o.channel.name} #{o.orderNo}
                    </span>
                    <span className="block text-[12.5px] text-dark-grey">
                      {day(o.placedAt, false, intl)} · {t(o.dishes === 1 ? "{n} dish" : "{n} dishes", { n: o.dishes })}
                      {o.salesSource === "menu" ? ` · ${t("prices from menu")}` : ""}
                      {o.document?.autoSaved ? ` · ${t("saved automatically")}` : ""}
                    </span>
                  </span>
                  <span className="text-end tabular-nums">
                    {money(o.foodSalesFils)}
                    <span className="block text-[12px] text-dark-grey">{o.feesFils != null ? t("fees ~{amount}", { amount: money(o.feesFils) }) : t("fees unknown")}</span>
                  </span>
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
