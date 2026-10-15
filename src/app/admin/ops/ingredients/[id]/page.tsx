import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { IngredientForm, MergeForm, MovementForm } from "@/components/admin/ops/forms";
import { UNIT, amountText, day, unitPrice } from "@/components/admin/ops/format";
import { getIngredient } from "@/lib/ops/catalog";
import { chosenCost, getOpsSettings } from "@/lib/ops/settings";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Ingredient") };
}

const MOVEMENT_LABEL: Record<string, string> = {
  OPENING: "Opening stock",
  PURCHASE: "Bought",
  CONSUMPTION: "Used",
  WASTE: "Waste",
  STAFF_MEAL: "Staff meal",
  ADJUSTMENT: "Correction",
  COUNT: "Stock count",
};

export default async function IngredientPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale, intl } = await getAdminI18n();
  const { id } = await params;
  const [ingredient, settings] = await Promise.all([getIngredient(id), getOpsSettings()]);
  if (!ingredient) notFound();
  const unit = UNIT[ingredient.unit];
  const sameUnit = await prisma.ingredient.findMany({
    where: { id: { not: id }, unit: ingredient.unit },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Price per kg / L / piece for each purchase, with or without VAT as chosen in Ops settings.
  const prices = ingredient.purchaseLines
    .filter((l) => l.baseQty && l.netFils != null)
    .map((l) => ({
      id: l.id,
      at: l.invoice.invoiceDate,
      supplier: l.invoice.supplier,
      documentId: l.invoice.documentId,
      qty: l.baseQty!,
      perBase: chosenCost(l.netFils, l.grossFils, settings.foodCostIncludesVat)! / l.baseQty!,
    }));
  // Latest price from each supplier → who is cheapest now.
  const latestBySupplier = new Map<string, (typeof prices)[number]>();
  for (const p of prices) if (!latestBySupplier.has(p.supplier.id)) latestBySupplier.set(p.supplier.id, p);
  const bySupplier = [...latestBySupplier.values()].sort((a, b) => a.perBase - b.perBase);

  return (
    <AdminPage
      title={
        <span className="flex flex-wrap items-center gap-3">
          <Link href="/admin/ops/stock" aria-label={t("Back to stock")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black-iron/[0.05]">
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          <span dir="auto">{ingredient.name}</span>
          {ingredient.nameFa && (
            <span lang="fa" dir="rtl" className="text-[0.75em] font-normal text-dark-grey">
              {ingredient.nameFa}
            </span>
          )}
        </span>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-[12.5px] text-dark-grey">{t("On hand")}</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums">{amountText(ingredient.onHand, unit, locale)}</p>
        </Card>
        <Card>
          <p className="text-[12.5px] text-dark-grey">{t(settings.foodCostIncludesVat ? "Last price (with VAT)" : "Last price (ex VAT)")}</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums">{prices[0] ? unitPrice(prices[0].perBase, unit, locale) : "—"}</p>
        </Card>
        <Card>
          <p className="text-[12.5px] text-dark-grey">{t("Cheapest now")}</p>
          <p dir="auto" className="mt-1 text-[16px] font-semibold">{bySupplier[0]?.supplier.name ?? "—"}</p>
          {bySupplier.length > 1 && <p className="text-[12.5px] text-dark-grey">{t("of {n} suppliers", { n: bySupplier.length })}</p>}
        </Card>
      </div>

      <Card title={t("Waste, staff meal or correction")}>
        <MovementForm ingredientId={ingredient.id} unit={unit} />
      </Card>

      {bySupplier.length > 1 && (
        <Card title={t("By supplier")} description={t("Latest price from each supplier, cheapest first.")} bodyClassName="p-0">
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {bySupplier.map((p, i) => (
              <li key={p.supplier.id} className="flex items-center justify-between gap-3 px-5 py-3 md:px-6">
                <Link href={`/admin/ops/suppliers/${p.supplier.id}`} dir="auto" className="font-medium hover:underline">
                  {p.supplier.name}
                </Link>
                <span className="flex items-center gap-2 tabular-nums">
                  {i === 0 && <StatusPill tone="good">{t("Cheapest")}</StatusPill>}
                  {unitPrice(p.perBase, unit, locale)}
                  <span className="text-[12.5px] text-dark-grey">{day(p.at, false, intl)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t("Price history")} bodyClassName="p-0">
        {prices.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-dark-grey md:px-6">{t("No purchases yet.")}</p>
        ) : (
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {prices.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3 md:px-6">
                <span className="w-16 shrink-0 text-dark-grey">{day(p.at, false, intl)}</span>
                <span dir="auto" className="min-w-0 flex-1 truncate">
                  {p.documentId ? (
                    <Link href={`/admin/ops/invoices/${p.documentId}`} className="hover:underline">
                      {p.supplier.name}
                    </Link>
                  ) : (
                    p.supplier.name
                  )}
                  <span className="text-dark-grey"> · {amountText(p.qty, unit, locale)}</span>
                </span>
                <span className="shrink-0 tabular-nums">{unitPrice(p.perBase, unit, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("Stock history")} bodyClassName="p-0">
        {ingredient.movements.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-dark-grey md:px-6">{t("Nothing yet.")}</p>
        ) : (
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {ingredient.movements.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3 md:px-6">
                <span className="w-16 shrink-0 text-dark-grey">{day(m.at, false, intl)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {MOVEMENT_LABEL[m.type] ? t(MOVEMENT_LABEL[m.type]) : m.type}
                  {m.note && (
                    <span className="text-dark-grey">
                      {" · "}
                      <span dir="auto">{m.note}</span>
                    </span>
                  )}
                </span>
                <span className={m.quantity < 0 ? "shrink-0 tabular-nums text-pomegranate-red" : "shrink-0 tabular-nums text-olive-leaf"}>
                  {m.quantity < 0 ? "−" : "+"}
                  {amountText(Math.abs(m.quantity), unit, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("Details")}>
        <IngredientForm ingredient={{ id: ingredient.id, name: ingredient.name, nameFa: ingredient.nameFa, category: ingredient.category === "PACKAGING" || ingredient.category === "SUPPLIES" ? ingredient.category : "FOOD", unit, lowStockAt: ingredient.lowStockAt }} />
      </Card>

      <Card
        title={t("Merge")}
        description={t("Same ingredient saved twice? Move everything into the right one (both counted in {unit}).", {
          unit: t(unit === "g" ? "kg" : unit === "ml" ? "litres" : "pieces"),
        })}
      >
        <MergeForm url={`/api/admin/ops/ingredients/${ingredient.id}/merge`} options={sameUnit} noun="ingredient" redirectTo="/admin/ops/ingredients/{id}" />
      </Card>
    </AdminPage>
  );
}
