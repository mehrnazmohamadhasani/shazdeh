import { grossQuantity } from "./recipe-cost";

/*
 * What selling a dish takes out of stock: its APPROVED recipe, scaled to
 * the portions sold, with sub-recipes (cooked rice, khoresh base) opened
 * up into their raw ingredients and trim/peel waste added back — the
 * amount that actually leaves the shelf. Drafts never count (brief §6.4):
 * a dish whose recipe, or any prep inside it, has no approved version
 * takes nothing and is reported instead of guessed.
 */

export type ApprovedLine = { ingredientId: string | null; subRecipeId: string | null; quantity: number; wastePct: number };
export type ApprovedRecipe = {
  id: string;
  name: string;
  approved: { versionId: string; yieldQuantity: number; lines: ApprovedLine[] } | null;
};

export type DishUse =
  | { ok: true; versionId: string; ingredients: Map<string, number> }
  | { ok: false; reason: "no_recipe" | "not_approved" | "prep_not_approved" | "cycle"; detail?: string };

function add(into: Map<string, number>, id: string, amount: number) {
  into.set(id, (into.get(id) ?? 0) + amount);
}

/** Ingredients for `amount` of a recipe's yield (portions for a dish, g/ml/pcs for a prep). */
function expand(recipe: ApprovedRecipe, amount: number, recipes: Map<string, ApprovedRecipe>, into: Map<string, number>, path: string[]): DishUse | null {
  const v = recipe.approved!;
  const factor = v.yieldQuantity > 0 ? amount / v.yieldQuantity : 0;
  for (const line of v.lines) {
    const needed = grossQuantity(line.quantity * factor, line.wastePct);
    if (line.ingredientId) {
      add(into, line.ingredientId, needed);
      continue;
    }
    if (!line.subRecipeId) continue;
    if (path.includes(line.subRecipeId)) return { ok: false, reason: "cycle" };
    const prep = recipes.get(line.subRecipeId);
    if (!prep?.approved) return { ok: false, reason: "prep_not_approved", detail: prep?.name };
    const fail = expand(prep, needed, recipes, into, [...path, prep.id]);
    if (fail) return fail;
  }
  return null;
}

/** Stock used by `portions` of a dish. */
export function dishUse(recipe: ApprovedRecipe | undefined, portions: number, recipes: Map<string, ApprovedRecipe>): DishUse {
  if (!recipe) return { ok: false, reason: "no_recipe" };
  if (!recipe.approved) return { ok: false, reason: "not_approved" };
  const ingredients = new Map<string, number>();
  const fail = expand(recipe, portions, recipes, ingredients, [recipe.id]);
  return fail ?? { ok: true, versionId: recipe.approved.versionId, ingredients };
}
