import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { DeleteRecipeButton, DiscardDraftButton, DraftEditor, RecipeDetailsForm, RecipeSheet, type SheetLine } from "@/components/admin/ops/recipe-forms";
import { UNIT, unitPrice } from "@/components/admin/ops/format";
import { issueText } from "@/components/admin/ops/recipe-issues";
import { getRecipe } from "@/lib/ops/recipes";
import { requireAdmin } from "@/lib/auth";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Recipe") };
}

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const [{ t, locale, money, number, date }, user, { id }, query] = await Promise.all([getAdminI18n(), requireAdmin(), params, searchParams]);
  const data = await getRecipe(id);
  if (!data) notFound();
  const { recipe, approved, draft, history, usedIn, options } = data;
  // The editor is open while there is a draft (or nothing approved yet); otherwise behind "Edit recipe".
  const editing = !!draft || !approved || query.edit === "1";
  const editHref = `/admin/ops/recipes/${recipe.id}?edit=1#edit`;
  const kind = recipe.kind;
  const name = (r: { name: string; nameFa?: string | null }) => (locale === "fa" && r.nameFa ? r.nameFa : r.name);

  const sheetLines = (v: NonNullable<typeof approved>): SheetLine[] =>
    v.version.lines.map((l, i) => ({
      key: l.id,
      name: l.ingredient ? name(l.ingredient) : name(l.subRecipe!),
      href: l.ingredient ? `/admin/ops/ingredients/${l.ingredient.id}` : `/admin/ops/recipes/${l.subRecipe!.id}`,
      unit: l.ingredient ? l.ingredient.unit : (options.preps.find((p) => p.id === l.subRecipeId)?.unit ?? "G"),
      quantity: l.quantity,
      wastePct: l.wastePct,
      costFils: v.cost.lines[i].costFils,
    }));

  // The editor starts from the draft, or from the approved version when there is none.
  const base = draft?.version ?? approved?.version;
  const editorKey = `${draft?.version.id ?? "new"}-${draft?.version.updatedAt.getTime() ?? approved?.version.id}`;
  const summary = (c: NonNullable<typeof approved>["cost"], yieldUnit: "G" | "ML" | "PCS") => (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[14px]">
      <span>
        <span className="text-dark-grey">{kind === "DISH" ? t("Cost per portion") : t("Cost per batch")}: </span>
        <span className="font-semibold tabular-nums">{money(Math.round(c.totalFils))}</span>
      </span>
      {kind === "PREP" && c.perUnitFils > 0 && <span className="tabular-nums text-dark-grey">{unitPrice(c.perUnitFils, UNIT[yieldUnit], locale)}</span>}
      {c.margin?.foodCostPct != null && (
        <span className="text-dark-grey">
          {t("Food cost {pct}% of {price} (ex VAT)", { pct: number(c.margin.foodCostPct, { max: 1 }), price: money(c.margin.priceExVatFils) })}
          {" · "}
          {t("Margin {amount}", { amount: money(Math.round(c.margin.marginFils)) })}
        </span>
      )}
    </div>
  );

  return (
    <AdminPage
      title={
        <span className="flex flex-wrap items-center gap-3">
          <Link href="/admin/ops/recipes" aria-label={t("Back to recipes")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black-iron/[0.05]">
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          <span dir="auto">{recipe.name}</span>
          {recipe.nameFa && (
            <span lang="fa" dir="rtl" className="text-[0.75em] font-normal text-dark-grey">
              {recipe.nameFa}
            </span>
          )}
        </span>
      }
      description={kind === "PREP" ? t("Prep — used by weight in other recipes.") : recipe.menuItem ? t("One portion of {dish}.", { dish: recipe.menuItem.name }) : t("Dish — not on the menu yet.")}
      actions={
        !editing ? (
          <Button asChild size="md">
            <Link href={editHref}>
              <Pencil className="h-4 w-4" /> {t("Edit recipe")}
            </Link>
          </Button>
        ) : undefined
      }
    >
      {approved && (
        <Card
          title={
            <span className="flex flex-wrap items-center gap-2">
              {t("Kitchen standard")} <StatusPill tone="neutral">{t("Version {n}", { n: approved.version.number })}</StatusPill>
              {approved.cost.verified ? <StatusPill tone="good">{t("Verified")}</StatusPill> : <StatusPill tone="warn">{t("Estimated")}</StatusPill>}
            </span>
          }
          description={
            approved.version.approvedAt ? t("Approved {date}", { date: date(approved.version.approvedAt, { day: "numeric", month: "short", year: "numeric" }) }) : undefined
          }
          bodyClassName="p-0"
        >
          <div className="px-5 pt-4 md:px-6">{summary(approved.cost, approved.version.yieldUnit)}</div>
          {!approved.cost.verified && (
            <ul className="mt-2 px-5 text-[13px] text-cinnamon-bark md:px-6">
              {approved.cost.issues.map((i, k) => (
                <li key={k}>{issueText(i, t)}</li>
              ))}
            </ul>
          )}
          <RecipeSheet lines={sheetLines(approved)} kind={kind} yieldQuantity={approved.version.yieldQuantity} yieldUnit={approved.version.yieldUnit} />
          {approved.version.method && (
            <div className="border-t border-black-iron/[0.06] px-5 py-4 md:px-6">
              <h3 className="mb-2 text-[13px] font-semibold text-dark-grey">{t("Method")}</h3>
              <p dir="auto" className="whitespace-pre-line text-[14px] leading-relaxed">
                {approved.version.method}
              </p>
            </div>
          )}
          {approved.version.sourceDocumentId && (
            <p className="border-t border-black-iron/[0.06] px-5 py-3 text-[13px] md:px-6">
              <Link href={`/admin/ops/recipes/import/${approved.version.sourceDocumentId}`} className="text-terracotta-ink underline-offset-4 hover:underline">
                {t("Read from a photo — see the original")}
              </Link>
            </p>
          )}
        </Card>
      )}

      {editing && (
        <div id="edit" className="scroll-mt-6">
          <Card
            title={
              draft ? (
                <span className="flex flex-wrap items-center gap-2">
                  {t("Draft")} <StatusPill tone="warn">{t("Version {n}", { n: draft.version.number })}</StatusPill>
                </span>
              ) : (
                t("Change the recipe")
              )
            }
            description={draft ? t("Not used by the kitchen until it is approved.") : undefined}
            actions={
              draft && approved ? (
                <DiscardDraftButton recipeId={recipe.id} />
              ) : !draft && approved ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/ops/recipes/${recipe.id}`}>{t("Cancel")}</Link>
                </Button>
              ) : undefined
            }
          >
            {draft?.version.sourceDocumentId && (
              <p className="mb-4 text-[13px]">
                <Link href={`/admin/ops/recipes/import/${draft.version.sourceDocumentId}`} className="text-terracotta-ink underline-offset-4 hover:underline">
                  {t("Read from a photo — see the original")}
                </Link>
              </p>
            )}
            {draft && draft.cost.issues.some((i) => i.kind !== "draft") && (
              <ul className="mb-4 text-[13px] text-cinnamon-bark">
                {draft.cost.issues.filter((i) => i.kind !== "draft").map((i, k) => (
                  <li key={k}>{issueText(i, t)}</li>
                ))}
              </ul>
            )}
            <DraftEditor
              key={editorKey}
              recipeId={recipe.id}
              kind={kind}
              initial={{
                yieldQuantity: base?.yieldQuantity ?? (kind === "DISH" ? 1 : 1000),
                yieldUnit: base?.yieldUnit ?? (kind === "DISH" ? "PCS" : "G"),
                note: draft?.version.note ?? null,
                method: base?.method ?? null,
                lines: (base?.lines ?? []).map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: l.quantity, wastePct: l.wastePct, note: l.note })),
              }}
              options={options}
              menuPriceAed={recipe.menuItem?.price ?? null}
              canApprove={user.role === "ADMIN"}
              startsNewVersion={!draft && !!approved}
            />
            {user.role !== "ADMIN" && <p className="mt-3 text-[12.5px] text-dark-grey">{t("Only the owner can approve a recipe.")}</p>}
          </Card>
        </div>
      )}

      {usedIn.length > 0 && (
        <Card title={t("Used in")}>
          <ul className="flex flex-wrap gap-2 text-[14px]">
            {usedIn.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/ops/recipes/${r.id}`} dir="auto" className="rounded-full bg-black-iron/[0.05] px-3 py-1.5 hover:bg-black-iron/[0.08]">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {history.length > 0 && (
        <Card title={t("Earlier versions")} bodyClassName="p-0">
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {history.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-5 py-3 md:px-6">
                <span className="w-24 shrink-0 font-medium">{t("Version {n}", { n: v.number })}</span>
                <span dir="auto" className="min-w-0 flex-1 truncate text-dark-grey">
                  {v.lines.map((l) => `${l.ingredient?.name ?? l.subRecipe?.name} ${number(l.quantity)}`).join(" · ")}
                </span>
                <span className="shrink-0 text-[12.5px] text-dark-grey">
                  {v.approvedAt ? date(v.approvedAt, { day: "numeric", month: "short", year: "numeric" }) : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t("Details")}>
        <RecipeDetailsForm recipe={{ id: recipe.id, name: recipe.name, nameFa: recipe.nameFa }} />
        {!approved && !history.length && (
          <div className="mt-5 border-t border-black-iron/[0.06] pt-5">
            <DeleteRecipeButton recipeId={recipe.id} />
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
