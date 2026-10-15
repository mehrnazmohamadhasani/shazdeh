import Link from "next/link";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { NewDishRecipeButton, NewPrepForm } from "@/components/admin/ops/recipe-forms";
import { UNIT, unitPrice } from "@/components/admin/ops/format";
import { issueText } from "@/components/admin/ops/recipe-issues";
import { listRecipes } from "@/lib/ops/recipes";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Recipes") };
}

export default async function RecipesPage() {
  const { t, locale, money, number, price } = await getAdminI18n();
  const { dishes, orphanDishes, preps } = await listRecipes();
  const done = dishes.filter((d) => d.recipe?.hasApproved).length;
  const name = (r: { name: string; nameFa: string | null }) => (locale === "fa" && r.nameFa ? r.nameFa : r.name);

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
    >
      <Card
        title={t("Dishes")}
        description={t("{done} of {total} dishes have an approved recipe.", { done, total: dishes.length })}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead>
              <tr className="border-b border-black-iron/[0.06] text-start text-[12px] text-dark-grey">
                <th className="px-5 py-3 text-start font-medium md:px-6">{t("Dish")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("Menu price")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("Food cost")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("Food cost %")}</th>
                <th className="px-5 py-3 text-end font-medium md:px-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black-iron/[0.06]">
              {dishes.map(({ menuItem, recipe }) => (
                <tr key={menuItem.id} className="hover:bg-black-iron/[0.02]">
                  <td className="px-5 py-3 md:px-6">
                    {recipe ? (
                      <Link href={`/admin/ops/recipes/${recipe.id}`} dir="auto" className="font-medium hover:underline">
                        {name(menuItem)}
                      </Link>
                    ) : (
                      <span dir="auto" className="font-medium">{name(menuItem)}</span>
                    )}
                    <span className="ms-2 text-[12px] text-dark-grey">{menuItem.category.name}</span>
                  </td>
                  <td className="px-3 py-3 text-end tabular-nums text-dark-grey">{price(menuItem.price)}</td>
                  <td className="px-3 py-3 text-end tabular-nums">{recipe?.perUnitFils != null ? money(Math.round(recipe.perUnitFils)) : "—"}</td>
                  <td className="px-3 py-3 text-end tabular-nums">
                    {recipe?.margin?.foodCostPct != null ? `${number(recipe.margin.foodCostPct, { max: 1 })}%` : "—"}
                  </td>
                  <td className="px-5 py-3 text-end md:px-6">{recipe ? status(recipe) : <NewDishRecipeButton menuItemId={menuItem.id} />}</td>
                </tr>
              ))}
              {orphanDishes.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 md:px-6" colSpan={4}>
                    <Link href={`/admin/ops/recipes/${r.id}`} dir="auto" className="font-medium hover:underline">
                      {name(r)}
                    </Link>
                    <span className="ms-2 text-[12px] text-dark-grey">{t("not on the menu")}</span>
                  </td>
                  <td className="px-5 py-3 text-end md:px-6">{status(r)}</td>
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
              </li>
            ))}
          </ul>
        )}
        <div className="p-5 md:p-6">
          <NewPrepForm />
        </div>
      </Card>
    </AdminPage>
  );
}
