import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { NewRecipeDialog } from "@/components/admin/ops/recipe-forms";
import { UNIT, unitPrice } from "@/components/admin/ops/format";
import { issueText } from "@/components/admin/ops/recipe-issues";
import { listRecipes } from "@/lib/ops/recipes";
import { listRecipeDocuments, parseStoredRecipe } from "@/lib/ops/recipe-import";
import { UploadButton } from "@/components/admin/ops/upload-button";
import { TableFilter } from "@/components/admin/table-filter";
import { DOC_STATUS } from "@/components/admin/ops/status";
import { day } from "@/components/admin/ops/format";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Recipes") };
}

export default async function RecipesPage() {
  const { t, locale, money, number, price, intl } = await getAdminI18n();
  const [{ dishes, orphanDishes, preps }, photos] = await Promise.all([listRecipes(), listRecipeDocuments()]);
  const done = dishes.filter((d) => d.recipe?.hasApproved).length;
  const name = (r: { name: string; nameFa: string | null }) => (locale === "fa" && r.nameFa ? r.nameFa : r.name);

  // Big enough to hit with a wet thumb; opens the recipe straight in its editor.
  const edit = (id: string) => (
    <Link
      href={`/admin/ops/recipes/${id}?edit=1#edit`}
      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black-iron/15 px-3.5 text-[13px] font-medium hover:border-terracotta hover:text-terracotta-ink"
    >
      <Pencil className="h-3.5 w-3.5" /> {t("Edit")}
    </Link>
  );

  type Row = (typeof preps)[number];
  const status = (r: Row) =>
    r.verified ? (
      <StatusPill tone="good">{t("Verified")}</StatusPill>
    ) : (
      <StatusPill tone="warn" className="cursor-help">
        <span title={r.issues.map((i) => issueText(i, t)).join(" · ")}>{r.hasApproved ? t("Estimated") : t("Draft")}</span>
      </StatusPill>
    );

  return (
    <AdminPage
      title={t("Recipes")}
      description={t("Grams per portion for every dish. The cost follows the latest invoice prices; only approved recipes count as the kitchen standard.")}
      actions={
        <>
          {/* A dish's recipe starts on the dish: add the dish to the menu first, then its recipe. */}
          <Link
            href="/admin/menu-items/new"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-black-iron/20 px-5 text-[13px] font-medium uppercase tracking-[0.12em] text-black-iron hover:border-terracotta hover:text-terracotta-ink"
          >
            <Plus className="h-4 w-4" /> {t("New dish")}
          </Link>
          <UploadButton kind="recipe" label={t("Read recipe from photo")} />
        </>
      }
    >
      {photos.length > 0 && (
        <Card title={t("Recipe photos to check")} description={t("Read by AI — check each one and save it as a draft.")} bodyClassName="p-0">
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {photos.map((p) => {
              const reading = parseStoredRecipe(p.extraction);
              const status = DOC_STATUS[p.status];
              return (
                <li key={p.id}>
                  <Link href={`/admin/ops/recipes/import/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-black-iron/[0.02] md:px-6">
                    <span dir="auto" className="min-w-0 flex-1 truncate font-medium">
                      {reading?.title ?? t("Recipe photo")}
                      {reading && <span className="font-normal text-dark-grey"> · {t("{n} ingredients", { n: reading.lines.length })}</span>}
                    </span>
                    <span className="shrink-0 text-[12.5px] text-dark-grey">{day(p.createdAt, false, intl)}</span>
                    <StatusPill tone={status.tone}>{t(status.label)}</StatusPill>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card
        title={t("Dishes")}
        description={t("{done} of {total} dishes have an approved recipe.", { done, total: dishes.length })}
        bodyClassName="p-0"
      >
        <div className="border-b border-black-iron/[0.06] p-3 md:px-6">
          <TableFilter target="dish-rows" placeholder={t("Search dishes")} className="max-w-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-black-iron/[0.06] text-start text-[12px] text-dark-grey">
                <th className="px-5 py-3 text-start font-medium md:px-6">{t("Dish")}</th>
                <th className="px-3 py-3 text-end font-medium max-sm:hidden">{t("Menu price")}</th>
                <th className="px-3 py-3 text-end font-medium max-sm:hidden">{t("Food cost")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("Food cost %")}</th>
                <th className="px-5 py-3 text-end font-medium md:px-6" />
              </tr>
            </thead>
            <tbody id="dish-rows" className="divide-y divide-black-iron/[0.06]">
              {dishes.map(({ menuItem, recipe }) => (
                <tr key={menuItem.id} data-search={`${menuItem.name} ${menuItem.nameFa ?? ""} ${menuItem.category.name}`} className="hover:bg-black-iron/[0.02]">
                  <td className="px-5 py-3 md:px-6">
                    <Link href={recipe ? `/admin/ops/recipes/${recipe.id}` : `/admin/menu-items/${menuItem.id}#recipe`} dir="auto" className="font-medium hover:underline">
                      {name(menuItem)}
                    </Link>
                    <span className="ms-2 text-[12px] text-dark-grey">{menuItem.category.name}</span>
                  </td>
                  <td className="px-3 py-3 text-end tabular-nums text-dark-grey max-sm:hidden">{price(menuItem.price)}</td>
                  <td className="px-3 py-3 text-end tabular-nums max-sm:hidden">{recipe?.perUnitFils != null ? money(Math.round(recipe.perUnitFils)) : "—"}</td>
                  <td className="px-3 py-3 text-end tabular-nums">
                    {recipe?.margin?.foodCostPct != null ? `${number(recipe.margin.foodCostPct, { max: 1 })}%` : "—"}
                  </td>
                  <td className="px-5 py-3 text-end md:px-6">
                    {recipe ? (
                      <span className="inline-flex items-center gap-2">
                        {status(recipe)}
                        {edit(recipe.id)}
                      </span>
                    ) : (
                      // On the dish's page: type it, a photo or PDF, or say it to the assistant.
                      <Link
                        href={`/admin/menu-items/${menuItem.id}#recipe`}
                        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-terracotta/40 px-3.5 text-[13px] font-medium text-terracotta-ink hover:bg-terracotta/[0.06]"
                      >
                        <Plus className="h-3.5 w-3.5" /> {t("Add recipe")}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {orphanDishes.map((r) => (
                <tr key={r.id} data-search={`${r.name} ${r.nameFa ?? ""}`}>
                  <td className="px-5 py-3 md:px-6" colSpan={4}>
                    <Link href={`/admin/ops/recipes/${r.id}`} dir="auto" className="font-medium hover:underline">
                      {name(r)}
                    </Link>
                    <span className="ms-2 text-[12px] text-dark-grey">{t("not on the menu")}</span>
                  </td>
                  <td className="px-5 py-3 text-end md:px-6">
                    <span className="inline-flex items-center gap-2">
                      {status(r)}
                      {edit(r.id)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={t("Preps")}
        description={t("Things cooked in batches and used by weight in dishes: cooked rice, tahdig, khoresh base, fried onion.")}
        bodyClassName="p-0"
      >
        {preps.length > 0 && (
          <ul className="divide-y divide-black-iron/[0.06] border-b border-black-iron/[0.06] text-[14px]">
            {preps.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3 md:px-6">
                <Link href={`/admin/ops/recipes/${p.id}`} dir="auto" className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {name(p)}
                </Link>
                <span className="shrink-0 tabular-nums text-dark-grey">
                  {p.perUnitFils != null && p.perUnitFils > 0 ? unitPrice(p.perUnitFils, UNIT[p.yieldUnit], locale) : "—"}
                </span>
                {status(p)}
                {edit(p.id)}
              </li>
            ))}
          </ul>
        )}
        <div className="p-5 md:p-6">
          <NewRecipeDialog dishes={[]} kind="PREP" onlyKind label={t("New prep")} variant="outline" />
        </div>
      </Card>
    </AdminPage>
  );
}
