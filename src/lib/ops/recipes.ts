import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { OpsError } from "./documents";
import { costVersion, dishMargin, wouldCycle, type CostContext, type CostRecipe, type CostVersion } from "./recipe-cost";

/*
 * Recipes: a DISH is one portion of a menu item, a PREP is a sub-recipe
 * (cooked rice, khoresh base) used by weight. Each recipe has at most one
 * APPROVED version (the kitchen standard, never edited) and at most one
 * DRAFT. Saving edits the draft; approving retires the old standard.
 * Every change is audited with the lines before and after.
 */

type Actor = { id: string; email: string };
type Unit = "G" | "ML" | "PCS";

export type DraftLineInput = {
  ingredientId: string | null;
  subRecipeId: string | null;
  quantity: number;
  wastePct: number;
  note: string | null;
};

// ─── Costs ──────────────────────────────────────────────────────────────────

/**
 * Fils per g / ml / pc of every ingredient: the latest purchase (or valued
 * opening stock) on or before `asOf`, ex VAT, skipping undone invoices —
 * the same source as the Stock screen's "Last price".
 */
async function latestPrices(asOf: Date) {
  const rows = await prisma.stockMovement.findMany({
    where: { type: { in: ["PURCHASE", "OPENING"] }, reversedBy: null, costFils: { not: null }, quantity: { gt: 0 }, at: { lte: asOf } },
    orderBy: { at: "desc" },
    distinct: ["ingredientId"],
    select: { ingredientId: true, costFils: true, quantity: true, at: true },
  });
  return new Map(rows.map((r) => [r.ingredientId, { filsPerUnit: r.costFils! / r.quantity, at: r.at }]));
}

const versionInclude = {
  lines: {
    orderBy: { order: "asc" },
    include: {
      ingredient: { select: { id: true, name: true, nameFa: true, unit: true } },
      subRecipe: { select: { id: true, name: true, nameFa: true } },
    },
  },
} satisfies Prisma.RecipeVersionInclude;

function toCostVersion(v: { status: CostVersion["status"]; yieldQuantity: number; lines: CostVersion["lines"] }): CostVersion {
  return {
    status: v.status,
    yieldQuantity: v.yieldQuantity,
    lines: v.lines.map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: l.quantity, wastePct: l.wastePct })),
  };
}

/** Everything costing needs: all ingredients with prices and every recipe's approved + draft version. */
async function loadCostContext(asOf = new Date()) {
  const [ingredients, prices, recipes] = await Promise.all([
    prisma.ingredient.findMany({ select: { id: true, name: true, nameFa: true, unit: true, category: true }, orderBy: { name: "asc" } }),
    latestPrices(asOf),
    prisma.recipe.findMany({
      include: { versions: { where: { status: { in: ["APPROVED", "DRAFT"] } }, include: { lines: true } } },
    }),
  ]);
  const ctx: CostContext = {
    ingredients: new Map(ingredients.map((i) => [i.id, { name: i.name, filsPerUnit: prices.get(i.id)?.filsPerUnit ?? null }])),
    recipes: new Map(
      recipes.map((r): [string, CostRecipe] => {
        const approved = r.versions.find((v) => v.status === "APPROVED");
        const draft = r.versions.find((v) => v.status === "DRAFT");
        return [r.id, { id: r.id, name: r.name, approved: approved ? toCostVersion(approved) : null, draft: draft ? toCostVersion(draft) : null }];
      }),
    ),
  };
  return { ctx, ingredients, prices, recipes };
}

// ─── Reading ────────────────────────────────────────────────────────────────

/** Every recipe with its current cost, plus the menu items that have none yet. */
export async function listRecipes() {
  const [{ ctx, recipes }, menuItems] = await Promise.all([
    loadCostContext(),
    prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
      select: { id: true, name: true, nameFa: true, price: true, category: { select: { name: true } } },
    }),
  ]);
  const rows = recipes.map((r) => {
    const current = ctx.recipes.get(r.id)!;
    const version = current.approved ?? current.draft;
    const cost = version ? costVersion(version, ctx, [r.id]) : null;
    const menuItem = menuItems.find((m) => m.id === r.menuItemId) ?? null;
    const yieldUnit = (r.versions.find((v) => v.status === "APPROVED") ?? r.versions[0])?.yieldUnit ?? "PCS";
    return {
      id: r.id,
      kind: r.kind,
      name: r.name,
      nameFa: r.nameFa,
      menuItemId: r.menuItemId,
      hasApproved: !!current.approved,
      hasDraft: !!current.draft,
      yieldUnit,
      perUnitFils: cost?.perUnitFils ?? null,
      verified: cost?.verified ?? false,
      issues: cost?.issues ?? [],
      margin: r.kind === "DISH" && menuItem && cost ? dishMargin(cost.perUnitFils, menuItem.price) : null,
    };
  });
  return {
    dishes: menuItems.map((m) => ({ menuItem: m, recipe: rows.find((r) => r.menuItemId === m.id) ?? null })),
    // A dish recipe whose menu item was removed still shows, so nothing is lost.
    orphanDishes: rows.filter((r) => r.kind === "DISH" && !menuItems.some((m) => m.id === r.menuItemId)),
    preps: rows.filter((r) => r.kind === "PREP").sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function getRecipe(id: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      menuItem: { select: { id: true, name: true, price: true } },
      versions: { orderBy: { number: "desc" }, include: versionInclude },
      usedIn: { select: { version: { select: { status: true, recipe: { select: { id: true, name: true } } } } } },
    },
  });
  if (!recipe) return null;
  const { ctx, ingredients, prices, recipes } = await loadCostContext();

  const cost = (v: (typeof recipe.versions)[number] | undefined) => {
    if (!v) return null;
    const c = costVersion(toCostVersion(v), ctx, [recipe.id]);
    return { ...c, margin: recipe.menuItem ? dishMargin(c.perUnitFils, recipe.menuItem.price) : null };
  };
  const approved = recipe.versions.find((v) => v.status === "APPROVED");
  const draft = recipe.versions.find((v) => v.status === "DRAFT");

  // What the draft editor can pick from, with live prices for its cost preview.
  const preps = recipes
    .filter((r) => r.kind === "PREP" && r.id !== recipe.id)
    .map((r) => {
      const c = ctx.recipes.get(r.id)!;
      const v = c.approved ?? c.draft;
      const yieldUnit = r.versions.find((x) => x.status === "APPROVED")?.yieldUnit ?? r.versions[0]?.yieldUnit ?? "G";
      return {
        id: r.id,
        name: r.name,
        nameFa: r.nameFa,
        unit: yieldUnit as Unit,
        filsPerUnit: v ? costVersion(v, ctx, [r.id]).perUnitFils : null,
        approved: !!c.approved,
        // Using it here would make it contain itself.
        blocked: wouldCycle(recipe.id, [r.id], new Map(recipes.map((x) => [x.id, x]))),
      };
    })
    .filter((p) => !p.blocked)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    recipe,
    approved: approved ? { version: approved, cost: cost(approved)! } : null,
    draft: draft ? { version: draft, cost: cost(draft)! } : null,
    history: recipe.versions.filter((v) => v.status === "RETIRED"),
    usedIn: [...new Map(recipe.usedIn.filter((u) => u.version.status !== "RETIRED").map((u) => [u.version.recipe.id, u.version.recipe])).values()],
    options: {
      ingredients: ingredients
        .filter((i) => i.category !== "SUPPLIES")
        .map((i) => ({ id: i.id, name: i.name, nameFa: i.nameFa, unit: i.unit as Unit, filsPerUnit: prices.get(i.id)?.filsPerUnit ?? null })),
      preps,
    },
  };
}

// ─── Writing ────────────────────────────────────────────────────────────────

function linesSnapshot(lines: { ingredientId: string | null; subRecipeId: string | null; quantity: number; wastePct: number }[]) {
  return lines.map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: l.quantity, wastePct: l.wastePct }));
}

/** Locks the recipe row so two people saving or approving at once queue up. */
async function lockRecipe(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Recipe" WHERE "id" = ${id} FOR UPDATE`;
  if (rows.length === 0) throw new OpsError("Recipe not found.", 404);
}

export async function createRecipe(
  input: { kind: "DISH" | "PREP"; menuItemId: string | null; name: string | null; nameFa: string | null; yieldUnit: Unit },
  actor: Actor,
) {
  let name = input.name;
  let nameFa = input.nameFa;
  // A dish can also be written before it is on the menu (name only); link it later.
  if (input.kind === "DISH" && input.menuItemId) {
    const item = await prisma.menuItem.findUnique({ where: { id: input.menuItemId }, include: { recipe: { select: { id: true } } } });
    if (!item) throw new OpsError("Dish not found.", 404);
    if (item.recipe) return { id: item.recipe.id };
    name = name || item.name;
    nameFa = nameFa ?? item.nameFa;
  }
  if (!name) throw new OpsError("Enter a name.");
  const clash = await prisma.recipe.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (clash) throw new OpsError(`A recipe called "${name}" already exists.`, 409);

  const recipe = await prisma.recipe.create({
    data: {
      kind: input.kind,
      name,
      nameFa,
      menuItemId: input.kind === "DISH" ? input.menuItemId : null,
      versions: {
        create: {
          number: 1,
          status: "DRAFT",
          yieldQuantity: input.kind === "DISH" ? 1 : 1000,
          yieldUnit: input.kind === "DISH" ? "PCS" : input.yieldUnit,
          createdById: actor.id,
        },
      },
    },
  });
  await prisma.auditLog.create({
    data: { actor: actor.email, action: "recipe.create", entity: "Recipe", entityId: recipe.id, after: { kind: recipe.kind, name, menuItemId: recipe.menuItemId } },
  });
  return { id: recipe.id };
}

export async function updateRecipeDetails(id: string, data: { name: string; nameFa: string | null }, actor: Actor) {
  const before = await prisma.recipe.findUnique({ where: { id } });
  if (!before) throw new OpsError("Recipe not found.", 404);
  const clash = await prisma.recipe.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, id: { not: id } }, select: { id: true } });
  if (clash) throw new OpsError(`A recipe called "${data.name}" already exists.`, 409);
  await prisma.recipe.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: { actor: actor.email, action: "recipe.update", entity: "Recipe", entityId: id, before: { name: before.name, nameFa: before.nameFa }, after: data },
  });
}

/**
 * Saves the draft: replaces its lines, or starts a new draft (next number)
 * when only an approved version exists. Approved versions are never touched.
 */
export async function saveDraft(id: string, input: DraftInput, actor: Actor) {
  return prisma.$transaction((tx) => writeDraft(tx, id, input, actor));
}

export type DraftInput = {
  yieldQuantity: number;
  yieldUnit: Unit;
  note: string | null;
  /** undefined = keep what the draft (or the approved version it starts from) has. */
  method?: string | null;
  lines: DraftLineInput[];
};

/** saveDraft inside a caller's transaction (the photo import uses it too). */
export async function writeDraft(
  tx: Prisma.TransactionClient,
  id: string,
  input: DraftInput,
  actor: Actor,
  source?: { documentId: string; via: string },
) {
  await lockRecipe(tx, id);
  const recipe = await tx.recipe.findUniqueOrThrow({ where: { id }, include: { versions: { include: { lines: true } } } });
  const yieldQuantity = recipe.kind === "DISH" ? 1 : input.yieldQuantity;
  const yieldUnit = recipe.kind === "DISH" ? "PCS" : input.yieldUnit;

  // Every source must exist and preps must not lead back to this recipe.
  const ingredientIds = [...new Set(input.lines.flatMap((l) => (l.ingredientId ? [l.ingredientId] : [])))];
  const subIds = [...new Set(input.lines.flatMap((l) => (l.subRecipeId ? [l.subRecipeId] : [])))];
  const [foundIngredients, subs] = await Promise.all([
    tx.ingredient.count({ where: { id: { in: ingredientIds } } }),
    tx.recipe.findMany({ where: { id: { in: subIds } }, select: { id: true, kind: true } }),
  ]);
  if (foundIngredients !== ingredientIds.length) throw new OpsError("An ingredient on this recipe no longer exists. Reload and try again.");
  if (subs.length !== subIds.length || subs.some((s) => s.kind !== "PREP")) throw new OpsError("Only preps can be used inside a recipe.");
  if (subIds.includes(id)) throw new OpsError("A recipe can't contain itself.");
  if (subIds.length) {
    const graph = await tx.recipe.findMany({ select: { id: true, versions: { where: { status: { in: ["APPROVED", "DRAFT"] } }, select: { lines: { select: { subRecipeId: true } } } } } });
    if (wouldCycle(id, subIds, new Map(graph.map((g) => [g.id, g])))) throw new OpsError("That prep already uses this recipe, so it can't go inside it.");
  }

  const draft = recipe.versions.find((v) => v.status === "DRAFT");
  const approved = recipe.versions.find((v) => v.status === "APPROVED");
  const lines = input.lines.map((l, order) => ({ ...l, order }));
  const method = input.method === undefined ? (draft ?? approved)?.method ?? null : input.method;
  const sourceDocumentId = source?.documentId ?? (draft ?? approved)?.sourceDocumentId ?? null;
  let versionId: string;
  if (draft) {
    await tx.recipeLine.deleteMany({ where: { versionId: draft.id } });
    await tx.recipeVersion.update({
      where: { id: draft.id },
      data: { yieldQuantity, yieldUnit, note: input.note, method, sourceDocumentId, lines: { create: lines } },
    });
    versionId = draft.id;
  } else {
    const number = Math.max(0, ...recipe.versions.map((v) => v.number)) + 1;
    const created = await tx.recipeVersion.create({
      data: { recipeId: id, number, status: "DRAFT", yieldQuantity, yieldUnit, note: input.note, method, sourceDocumentId, createdById: actor.id, lines: { create: lines } },
    });
    versionId = created.id;
  }
  await tx.auditLog.create({
    data: {
      actor: actor.email,
      action: "recipe.draft.save",
      entity: "RecipeVersion",
      entityId: versionId,
      via: source?.via ?? "manual",
      before: { lines: linesSnapshot((draft ?? approved)?.lines ?? []), yieldQuantity: (draft ?? approved)?.yieldQuantity ?? null },
      after: { lines: linesSnapshot(input.lines), yieldQuantity, ...(source ? { sourceDocumentId: source.documentId } : {}) },
    },
  });
  return { versionId };
}

/** Makes the draft the kitchen standard; the previous standard is retired, not deleted. */
export async function approveDraft(id: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRecipe(tx, id);
    const versions = await tx.recipeVersion.findMany({ where: { recipeId: id, status: { in: ["DRAFT", "APPROVED"] } }, include: { lines: true } });
    const draft = versions.find((v) => v.status === "DRAFT");
    const approved = versions.find((v) => v.status === "APPROVED");
    if (!draft) throw new OpsError("There is no draft to approve.", 409);
    if (draft.lines.length === 0) throw new OpsError("Add at least one ingredient before approving.");
    if (approved) await tx.recipeVersion.update({ where: { id: approved.id }, data: { status: "RETIRED" } });
    await tx.recipeVersion.update({ where: { id: draft.id }, data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "recipe.approve",
        entity: "RecipeVersion",
        entityId: draft.id,
        before: approved ? { version: approved.number, yieldQuantity: approved.yieldQuantity, lines: linesSnapshot(approved.lines) } : undefined,
        after: { version: draft.number, yieldQuantity: draft.yieldQuantity, lines: linesSnapshot(draft.lines) },
      },
    });
    return { version: draft.number };
  });
}

export async function discardDraft(id: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRecipe(tx, id);
    const draft = await tx.recipeVersion.findFirst({ where: { recipeId: id, status: "DRAFT" }, include: { lines: true } });
    if (!draft) throw new OpsError("There is no draft.", 404);
    const others = await tx.recipeVersion.count({ where: { recipeId: id, status: { not: "DRAFT" } } });
    if (others === 0) throw new OpsError("This is the only version — delete the recipe instead.", 409);
    await tx.recipeVersion.delete({ where: { id: draft.id } });
    await tx.auditLog.create({
      data: { actor: actor.email, action: "recipe.draft.discard", entity: "RecipeVersion", entityId: draft.id, before: { version: draft.number, lines: linesSnapshot(draft.lines) } },
    });
  });
}

/** Only a recipe that was never approved and isn't used anywhere can be deleted. */
export async function deleteRecipe(id: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRecipe(tx, id);
    const recipe = await tx.recipe.findUniqueOrThrow({ where: { id }, include: { versions: { include: { lines: true } }, _count: { select: { usedIn: true } } } });
    if (recipe.versions.some((v) => v.status !== "DRAFT")) throw new OpsError("An approved recipe is kept for history and can't be deleted.", 409);
    if (recipe._count.usedIn > 0) throw new OpsError("This prep is used in other recipes. Remove it from them first.", 409);
    await tx.recipe.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "recipe.delete",
        entity: "Recipe",
        entityId: id,
        before: { name: recipe.name, kind: recipe.kind, lines: linesSnapshot(recipe.versions.flatMap((v) => v.lines)) },
      },
    });
  });
}
