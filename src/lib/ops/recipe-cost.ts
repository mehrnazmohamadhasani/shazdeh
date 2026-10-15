/*
 * What a recipe costs, worked out from its lines and the latest purchase
 * prices — never stored, so a new invoice or an approved recipe changes
 * every number at once. Pure: the caller loads recipes and prices
 * (./recipes.ts), which keeps this testable without a database.
 *
 * Quantities are in g / ml / pcs (the stock units); prices are fils per
 * g / ml / pc, ex VAT. A cost is "verified" only when the version and
 * every prep it uses are approved and every ingredient has a price;
 * anything else is "estimated", with the reasons listed (brief §7, §13.2).
 */

export type CostLine = {
  ingredientId: string | null;
  subRecipeId: string | null;
  quantity: number;
  wastePct: number;
};

export type CostVersion = {
  status: "DRAFT" | "APPROVED" | "RETIRED";
  yieldQuantity: number;
  lines: CostLine[];
};

export type CostRecipe = {
  id: string;
  name: string;
  approved: CostVersion | null;
  draft: CostVersion | null;
};

export type CostContext = {
  recipes: Map<string, CostRecipe>;
  /** Ingredient id → name and fils per g / ml / pc (null = never bought with a price). */
  ingredients: Map<string, { name: string; filsPerUnit: number | null }>;
};

export type CostIssue =
  | { kind: "no_price"; name: string }
  | { kind: "draft_prep"; name: string }
  | { kind: "empty_prep"; name: string }
  | { kind: "cycle"; name: string }
  | { kind: "draft" }
  | { kind: "no_lines" };

export type CostedLine = { costFils: number | null };

export type VersionCost = {
  /** Sum of the lines that could be costed, in fils. */
  totalFils: number;
  /** Cost of one yield unit (one portion for a dish; one g / ml / pc of a prep). */
  perUnitFils: number;
  lines: CostedLine[];
  issues: CostIssue[];
  verified: boolean;
};

/** Amount bought to end up with `quantity` after trim / peel loss. */
export function grossQuantity(quantity: number, wastePct: number) {
  return wastePct > 0 ? quantity / (1 - wastePct / 100) : quantity;
}

function addIssue(issues: CostIssue[], issue: CostIssue) {
  const same = issues.some((i) => i.kind === issue.kind && ("name" in i ? i.name : "") === ("name" in issue ? issue.name : ""));
  if (!same) issues.push(issue);
}

export function costVersion(version: CostVersion, ctx: CostContext, path: string[] = []): VersionCost {
  const issues: CostIssue[] = [];
  if (version.status === "DRAFT") addIssue(issues, { kind: "draft" });
  if (version.lines.length === 0) addIssue(issues, { kind: "no_lines" });

  const lines = version.lines.map((line): CostedLine => {
    const amount = grossQuantity(line.quantity, line.wastePct);
    if (line.ingredientId) {
      const ing = ctx.ingredients.get(line.ingredientId);
      if (!ing || ing.filsPerUnit == null) {
        addIssue(issues, { kind: "no_price", name: ing?.name ?? "?" });
        return { costFils: null };
      }
      return { costFils: amount * ing.filsPerUnit };
    }
    const prep = line.subRecipeId ? ctx.recipes.get(line.subRecipeId) : undefined;
    if (!prep) {
      addIssue(issues, { kind: "empty_prep", name: "?" });
      return { costFils: null };
    }
    if (path.includes(prep.id)) {
      addIssue(issues, { kind: "cycle", name: prep.name });
      return { costFils: null };
    }
    const used = prep.approved ?? prep.draft;
    if (!used || used.lines.length === 0) {
      addIssue(issues, { kind: "empty_prep", name: prep.name });
      return { costFils: null };
    }
    if (!prep.approved) addIssue(issues, { kind: "draft_prep", name: prep.name });
    const inner = costVersion(used, ctx, [...path, prep.id]);
    for (const i of inner.issues) {
      // The prep's own state is reported once, as draft_prep / empty_prep.
      if (i.kind !== "draft" && i.kind !== "no_lines") addIssue(issues, i);
    }
    return { costFils: amount * inner.perUnitFils };
  });

  const totalFils = lines.reduce((s, l) => s + (l.costFils ?? 0), 0);
  return {
    totalFils,
    perUnitFils: version.yieldQuantity > 0 ? totalFils / version.yieldQuantity : 0,
    lines,
    issues,
    verified: issues.length === 0,
  };
}

/** Recipe ids reachable from `fromIds` through any version's prep lines. */
function reachable(fromIds: string[], recipes: Map<string, { versions: { lines: { subRecipeId: string | null }[] }[] }>) {
  const seen = new Set<string>();
  const stack = [...fromIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const v of recipes.get(id)?.versions ?? []) for (const l of v.lines) if (l.subRecipeId) stack.push(l.subRecipeId);
  }
  return seen;
}

/** True when using `subRecipeIds` inside `recipeId` would make a recipe contain itself. */
export function wouldCycle(
  recipeId: string,
  subRecipeIds: string[],
  recipes: Map<string, { versions: { lines: { subRecipeId: string | null }[] }[] }>,
) {
  return reachable(subRecipeIds, recipes).has(recipeId);
}

export const VAT_RATE = 0.05;

/** Menu prices include VAT (brief §4); food cost % is measured on the ex-VAT price. */
export function dishMargin(costPerPortionFils: number, menuPriceAed: number) {
  const priceExVatFils = Math.round((menuPriceAed * 100) / (1 + VAT_RATE));
  return {
    priceExVatFils,
    marginFils: priceExVatFils - costPerPortionFils,
    foodCostPct: priceExVatFils > 0 ? (costPerPortionFils / priceExVatFils) * 100 : null,
  };
}

