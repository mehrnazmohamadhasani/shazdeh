import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { AdminPage, Card, EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { UploadButton } from "@/components/admin/ops/upload-button";
import { UNIT, amountText, day, unitPrice } from "@/components/admin/ops/format";
import { stockSummary } from "@/lib/ops/documents";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Stock") };
}

export default async function StockPage() {
  const { t, locale, intl } = await getAdminI18n();
  const rows = await stockSummary();
  return (
    <AdminPage
      title={t("Stock")}
      description={t("What is in the kitchen: purchases in, waste and staff meals out, corrected by the weekly count.")}
      actions={
        <>
          <Button asChild variant="outline" size="md">
            <Link href="/admin/ops/stock/count">
              <ClipboardList className="h-4 w-4" /> {t("Count stock")}
            </Link>
          </Button>
          <UploadButton />
        </>
      }
    >
      <Card bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyState title={t("No stock yet")} description={t("Save your first supplier invoice and its ingredients appear here.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead>
                <tr className="border-b border-black-iron/[0.06] text-start text-[12px] text-dark-grey">
                  <th className="px-5 py-3 font-medium md:px-6">{t("Ingredient")}</th>
                  <th className="px-3 py-3 text-end font-medium">{t("On hand")}</th>
                  <th className="px-3 py-3 text-end font-medium">{t("Last price (ex VAT)")}</th>
                  <th className="px-5 py-3 font-medium md:px-6">{t("Last bought")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black-iron/[0.06]">
                {rows.map((r) => {
                  const unit = UNIT[r.unit];
                  return (
                    <tr key={r.id} className="hover:bg-black-iron/[0.02]">
                      <td className="px-5 py-3 font-medium md:px-6">
                        <Link href={`/admin/ops/ingredients/${r.id}`} dir="auto" className="hover:underline">
                          {r.name}
                        </Link>
                        {r.category === "PACKAGING" && <span className="ms-2 text-[12px] font-normal text-dark-grey">{t("packaging")}</span>}
                      </td>
                      <td className={`px-3 py-3 text-end tabular-nums ${r.onHand < 0 ? "text-pomegranate-red" : ""}`}>{amountText(r.onHand, unit, locale)}</td>
                      <td className="px-3 py-3 text-end tabular-nums text-dark-grey">
                        {r.lastPurchase?.costPerUnitFils != null ? unitPrice(r.lastPurchase.costPerUnitFils, unit, locale) : "—"}
                      </td>
                      <td className="px-5 py-3 text-dark-grey md:px-6">
                        {r.lastPurchase ? (
                          <>
                            {day(r.lastPurchase.at, false, intl)}
                            {r.lastPurchase.supplier ? (
                              <>
                                {" · "}
                                <span dir="auto">{r.lastPurchase.supplier}</span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
