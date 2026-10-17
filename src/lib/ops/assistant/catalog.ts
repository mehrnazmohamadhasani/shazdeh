import "server-only";
import { prisma } from "@/lib/prisma";
import { chosenCost, getOpsSettings } from "../settings";
import { findByName, type MatchResult, type Named } from "./match";
import type { ItemRef } from "./types";

/*
 * Everything the assistant matches names against: ingredients, recipes
 * and suppliers, each with its Persian name and the names learned from
 * invoices and recipe sheets. Small (one kitchen), so it is loaded whole.
 */

export type IngredientEntry = Named & { unit: "G" | "ML" | "PCS"; lowStockAt: number | null };
export type RecipeEntry = Named & { kind: "DISH" | "PREP"; menuItemId: string | null; menuPriceAed: number | null };
export type SupplierEntry = Named;
export type MenuEntry = Named;

export async function loadCatalog() {
  const [ingredients, recipes, suppliers, aliases, supplierItems, menuItems, menuAliases] = await Promise.all([
    prisma.ingredient.findMany({ select: { id: true, name: true, nameFa: true, unit: true, lowStockAt: true } }),
    prisma.recipe.findMany({ select: { id: true, name: true, nameFa: true, kind: true, menuItemId: true, menuItem: { select: { name: true, nameFa: true, price: true } } } }),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
    prisma.recipeNameAlias.findMany({ select: { rawName: true, ingredientId: true, recipeId: true } }),
    prisma.supplierItem.findMany({ select: { rawName: true, ingredientId: true } }),
    prisma.menuItem.findMany({ where: { isActive: true }, select: { id: true, name: true, nameFa: true } }),
    prisma.menuItemAlias.findMany({ select: { rawName: true, menuItemId: true } }),
  ]);
  const aliasesOf = (pick: (a: { ingredientId: string | null; recipeId: string | null }) => string | null, id: string) =>
    aliases.filter((a) => pick(a) === id).map((a) => a.rawName);
  return {
    ingredients: ingredients.map(
      (i): IngredientEntry => ({
        ...i,
        aliases: [...aliasesOf((a) => a.ingredientId, i.id), ...supplierItems.filter((s) => s.ingredientId === i.id).map((s) => s.rawName)],
      }),
    ),
    recipes: recipes.map(
      (r): RecipeEntry => ({
        id: r.id,
        name: r.name,
        nameFa: r.nameFa ?? r.menuItem?.nameFa ?? null,
        kind: r.kind,
        menuItemId: r.menuItemId,
        menuPriceAed: r.menuItem?.price ?? null,
        aliases: [...aliasesOf((a) => a.recipeId, r.id), ...(r.menuItem ? [r.menuItem.name] : []), ...(r.menuItem?.nameFa ? [r.menuItem.nameFa] : [])],
      }),
    ),
    suppliers: suppliers.map((s): SupplierEntry => ({ ...s, nameFa: null })),
    // Menu dishes, with the names platforms print for them (learned from receipts).
    menuItems: menuItems.map((m): MenuEntry => ({ ...m, aliases: menuAliases.filter((a) => a.menuItemId === m.id).map((a) => a.rawName) })),
  };
}

export type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

/** What the model is told when a name doesn't pin down one thing, so it can ask. */
export class NameError extends Error {
  constructor(
    public what: string,
    public query: string,
    public result: Exclude<MatchResult<Named>, { ok: true }>,
  ) {
    super(`${what} "${query}" ${result.reason === "ambiguous" ? "matches several" : "not found"}`);
  }
  toJSON() {
    const list = this.result.reason === "ambiguous" ? this.result.candidates : this.result.suggestions;
    return {
      error: this.result.reason,
      what: this.what,
      query: this.query,
      [this.result.reason === "ambiguous" ? "candidates" : "suggestions"]: list.map((c) => ({ name: c.name, nameFa: c.nameFa })),
      hint: this.result.reason === "ambiguous" ? "Ask the person which one they mean." : "Ask the person to say the name again or pick from the suggestions.",
    };
  }
}

export function pick<T extends Named>(what: string, query: string, items: T[]): T {
  const r = findByName(query, items);
  if (r.ok) return r.item;
  throw new NameError(what, query, r);
}

export const itemRef = (i: IngredientEntry): ItemRef => ({ id: i.id, name: i.name, nameFa: i.nameFa, unit: i.unit });

/** Stock on hand (g / ml / pcs) of the given ingredients. */
export async function onHand(ingredientIds: string[]) {
  const sums = await prisma.stockMovement.groupBy({ by: ["ingredientId"], where: { ingredientId: { in: ingredientIds } }, _sum: { quantity: true } });
  return new Map(ingredientIds.map((id) => [id, sums.find((s) => s.ingredientId === id)?._sum.quantity ?? 0]));
}

/**
 * Fils per g / ml / pc from each ingredient's latest purchase (or valued
 * opening stock) — the Stock screen's "last price". Absent = not known.
 */
export async function lastPrices(ingredientIds: string[]) {
  const [rows, settings] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { ingredientId: { in: ingredientIds }, type: { in: ["PURCHASE", "OPENING"] }, reversedBy: null, costFils: { not: null }, quantity: { gt: 0 } },
      orderBy: { at: "desc" },
      distinct: ["ingredientId"],
      select: { ingredientId: true, costFils: true, quantity: true, at: true, purchaseLine: { select: { grossFils: true, invoice: { select: { supplier: { select: { name: true } } } } } } },
    }),
    getOpsSettings(),
  ]);
  return new Map(
    rows.map((r) => [
      r.ingredientId,
      {
        filsPerUnit: chosenCost(r.costFils, r.purchaseLine?.grossFils, settings.foodCostIncludesVat)! / r.quantity,
        at: r.at,
        supplier: r.purchaseLine?.invoice.supplier.name ?? null,
      },
    ]),
  );
}

/** Value of an amount at the last price, rounded to fils; null when no price is known. */
export function valueOf(quantity: number, price: { filsPerUnit: number } | undefined): number | null {
  return price ? Math.round(quantity * price.filsPerUnit) : null;
}
