import Link from "next/link";
import { ClipboardList, PackageOpen } from "lucide-react";
import { AdminPage, Card, EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { UploadButton } from "@/components/admin/ops/upload-button";
import { TableFilter } from "@/components/admin/table-filter";
import { UNIT, amountText, day, unitPrice } from "@/components/admin/ops/format";
import { stockSummary } from "@/lib/ops/documents";
import { unusedIngredients } from "@/lib/ops/catalog";
import { DeleteUnusedIngredientsButton } from "@/components/admin/ops/forms";
import { CMS_ROLES } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getOpsSettings } from "@/lib/ops/settings";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Stock") };
}

export default async function StockPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { t, locale, intl } = await getAdminI18n();
  const { show } = await searchParams;
  const [all, settings, unused, user] = await Promise.all([stockSummary(), getOpsSettings(), unusedIngredients(), requireAdmin()]);
  // What we have by default; ingredients at zero (or below — needs a count) only when asked.
  const showAll = show === "all";
  const inStock = all.filter((r) => r.onHand > 0);
  const rows = showAll ? all : inStock;
  return (
    <AdminPage
      title={t("Stock")}
      description={t("What is in the kitchen: purchases in, waste and staff meals out, corrected by the weekly count.")}
      actions={
        <>
          <Button asChild variant="outline" size="md">
            <Link href="/admin/ops/stock/opening">
              <PackageOpen className="h-4 w-4" /> {t("Opening stock")}
            </Link>
          </Button>
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
        {all.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-black-iron/[0.06] p-3 md:px-6">
            <span className="flex gap-2">
              {[
                { on: !showAll, href: "/admin/ops/stock", label: t("In stock ({n})", { n: inStock.length }) },
                { on: showAll, href: "/admin/ops/stock?show=all", label: t("All ingredients ({n})", { n: all.length }) },
              ].map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={
                    tab.on
                      ? "inline-flex h-9 items-center rounded-full bg-black-iron px-4 text-[13.5px] font-medium text-warm-white"
                      : "inline-flex h-9 items-center rounded-full bg-black-iron/[0.05] px-4 text-[13.5px] font-medium text-black-iron hover:bg-black-iron/[0.09]"
                  }
                >
                  {tab.label}
                </Link>
              ))}
            </span>
            {rows.length > 8 && <TableFilter target="stock-rows" placeholder={t("Search ingredients")} className="max-w-sm flex-1" />}
            {/* Left over from undone invoices, or never used: one tap to clear them (same roles as merging). */}
            {showAll && unused.length > 0 && CMS_ROLES.includes(user.role) && (
              <span className="ms-auto">
                <DeleteUnusedIngredientsButton names={unused.map((u) => u.name)} />
              </span>
            )}
          </div>
        )}
        {all.length > 0 && rows.length === 0 ? (
          <EmptyState title={t("Nothing in stock")} description={t("Every ingredient is at zero. Add an invoice, or see all ingredients.")} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t("No stock yet")}
            description={t("Starting out? Enter what is in the kitchen today as the opening stock, then add this month's invoices.")}
            action={
              <Button asChild size="md">
                <Link href="/admin/ops/stock/opening">
                  <PackageOpen className="h-4 w-4" /> {t("Enter opening stock")}
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-black-iron/[0.06] text-start text-[12px] text-dark-grey">
                  <th className="px-5 py-3 text-start font-medium md:px-6">{t("Ingredient")}</th>
                  <th className="px-3 py-3 text-end font-medium">{t("On hand")}</th>
                  <th className="px-3 py-3 text-end font-medium">{t(settings.foodCostIncludesVat ? "Last price (with VAT)" : "Last price (ex VAT)")}</th>
                  <th className="px-5 py-3 text-start font-medium max-sm:hidden md:px-6">{t("Last bought")}</th>
                </tr>
              </thead>
              <tbody id="stock-rows" className="divide-y divide-black-iron/[0.06]">
                {rows.map((r) => {
                  const unit = UNIT[r.unit];
                  return (
                    <tr key={r.id} data-search={`${r.name} ${r.nameFa ?? ""}`} className="hover:bg-black-iron/[0.02]">
                      <td className="px-5 py-3 font-medium md:px-6">
                        <Link href={`/admin/ops/ingredients/${r.id}`} dir="auto" className="hover:underline">
                          {locale === "fa" && r.nameFa ? r.nameFa : r.name}
                        </Link>
                        {r.category === "PACKAGING" && <span className="ms-2 text-[12px] font-normal text-dark-grey">{t("packaging")}</span>}
                        {r.category === "SUPPLIES" && <span className="ms-2 text-[12px] font-normal text-dark-grey">{t("supplies")}</span>}
                      </td>
                      <td className={`px-3 py-3 text-end tabular-nums ${r.onHand < 0 ? "text-pomegranate-red" : ""}`}>{amountText(r.onHand, unit, locale)}</td>
                      <td className="px-3 py-3 text-end tabular-nums text-dark-grey">
                        {r.lastPurchase?.costPerUnitFils != null ? unitPrice(r.lastPurchase.costPerUnitFils, unit, locale) : "—"}
                      </td>
                      <td className="px-5 py-3 text-dark-grey max-sm:hidden md:px-6">
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
