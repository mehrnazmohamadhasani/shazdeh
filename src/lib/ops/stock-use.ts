import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/report-error";
import { dishUse, type ApprovedRecipe, type DishUse } from "./consumption";

/*
 * Sales take ingredients out of stock (CONSUMPTION movements), one row
 * per dish and ingredient, linked to the order, the dish and the approved
 * recipe version — so the ledger shows why stock went down and a later
 * recipe change never rewrites history.
 *
 *   Platform order  → when it is saved; reversed when it is undone.
 *   Website order   → when it is Ready (or later): the food is cooked.
 *                     A cancellation after that keeps the use — the
 *                     food was made; record it as waste if thrown away.
 */

type Tx = Prisma.TransactionClient;
type SaleRef = { platformOrderId: string; orderId?: never } | { orderId: string; platformOrderId?: never };
export type SaleItem = { menuItemId: string | null; name: string; quantity: number };
export type Skipped = { name: string; reason: Exclude<DishUse, { ok: true }>["reason"] | "not_matched"; detail?: string };

async function approvedRecipes(tx: Tx) {
  const rows = await tx.recipe.findMany({
    select: {
      id: true,
      name: true,
      menuItemId: true,
      versions: {
        where: { status: "APPROVED" },
        select: { id: true, yieldQuantity: true, lines: { select: { ingredientId: true, subRecipeId: true, quantity: true, wastePct: true } } },
      },
    },
  });
  const byId = new Map<string, ApprovedRecipe>();
  const byMenuItem = new Map<string, ApprovedRecipe>();
  for (const r of rows) {
    const v = r.versions[0];
    const recipe: ApprovedRecipe = { id: r.id, name: r.name, approved: v ? { versionId: v.id, yieldQuantity: v.yieldQuantity, lines: v.lines } : null };
    byId.set(r.id, recipe);
    if (r.menuItemId) byMenuItem.set(r.menuItemId, recipe);
  }
  return { byId, byMenuItem };
}

/**
 * Takes a sale's ingredients out of stock. Does nothing if this sale has
 * already used stock (safe to call twice). Returns the dishes it could
 * not use stock for, and why.
 */
export async function recordSaleUse(tx: Tx, ref: SaleRef, sale: { at: Date; label: string; items: SaleItem[]; actorId: string | null }) {
  const where = ref.platformOrderId ? { platformOrderId: ref.platformOrderId } : { orderId: ref.orderId };
  if (await tx.stockMovement.findFirst({ where: { ...where, type: "CONSUMPTION", reversesId: null }, select: { id: true } })) {
    return { used: 0, skipped: [] as Skipped[] };
  }
  const { byId, byMenuItem } = await approvedRecipes(tx);
  const skipped: Skipped[] = [];
  let used = 0;
  for (const item of sale.items) {
    if (!item.menuItemId) {
      skipped.push({ name: item.name, reason: "not_matched" });
      continue;
    }
    const use = dishUse(byMenuItem.get(item.menuItemId), item.quantity, byId);
    if (!use.ok) {
      skipped.push({ name: item.name, reason: use.reason, detail: use.detail });
      continue;
    }
    for (const [ingredientId, amount] of use.ingredients) {
      if (amount <= 0) continue;
      await tx.stockMovement.create({
        data: {
          ingredientId,
          type: "CONSUMPTION",
          quantity: -amount,
          at: sale.at,
          ...where,
          menuItemId: item.menuItemId,
          recipeVersionId: use.versionId,
          note: `${sale.label} · ${item.name} ×${item.quantity}`,
          createdById: sale.actorId,
        },
      });
    }
    used++;
  }
  return { used, skipped };
}

/** Puts back what a platform order took (before the order is removed). */
export async function reverseSaleUse(tx: Tx, platformOrderId: string, note: string, actorId: string | null) {
  const taken = await tx.stockMovement.findMany({
    where: { platformOrderId, type: "CONSUMPTION", reversesId: null, reversedBy: null },
  });
  const now = new Date();
  for (const m of taken) {
    await tx.stockMovement.create({
      data: {
        ingredientId: m.ingredientId,
        type: "ADJUSTMENT",
        quantity: -m.quantity,
        at: now,
        reversesId: m.id,
        menuItemId: m.menuItemId,
        note,
        createdById: actorId,
      },
    });
  }
  return taken.length;
}

/** Website order statuses that mean the food was cooked. */
const COOKED = ["READY", "OUT_FOR_DELIVERY", "DELIVERED"];

/**
 * Called after a website order changes status. Never throws: a stock
 * problem must not block the kitchen's order board.
 */
export async function takeStockForWebsiteOrder(orderId: string, status: string) {
  if (!COOKED.includes(status)) return;
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { number: true, source: true, items: { select: { menuItemId: true, name: true, quantity: true } } },
      });
      if (!order) return;
      const via = order.source === "WHATSAPP" ? "WhatsApp" : order.source === "PHONE" ? "Phone" : "Website";
      await recordSaleUse(tx, { orderId }, { at: new Date(), label: `${via} ${order.number}`, items: order.items, actorId: null });
    });
  } catch (e) {
    await reportError(e, { where: `stock use for order ${orderId}` });
  }
}

/** Per dish of a sale: did it take stock, and if not, why (as things stand now). */
export async function saleStockStatus(ref: SaleRef, items: SaleItem[]) {
  const where = ref.platformOrderId ? { platformOrderId: ref.platformOrderId } : { orderId: ref.orderId };
  const [moves, recipes] = await Promise.all([
    prisma.stockMovement.findMany({ where: { ...where, type: "CONSUMPTION", reversesId: null }, select: { menuItemId: true } }),
    prisma.$transaction((tx) => approvedRecipes(tx)),
  ]);
  const usedIds = new Set(moves.map((m) => m.menuItemId));
  return items.map((i) => {
    if (i.menuItemId && usedIds.has(i.menuItemId)) return { name: i.name, used: true as const };
    if (!i.menuItemId) return { name: i.name, used: false as const, reason: "not_matched" as const };
    const use = dishUse(recipes.byMenuItem.get(i.menuItemId), i.quantity, recipes.byId);
    return { name: i.name, used: false as const, reason: use.ok ? ("saved_before_recipe" as const) : use.reason, detail: use.ok ? undefined : use.detail };
  });
}
