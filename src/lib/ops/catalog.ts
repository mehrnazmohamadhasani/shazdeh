import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { OpsError, dubaiDate } from "./documents";

/*
 * Suppliers, ingredients, manual stock movements and payables. Every
 * change is audited; merges move history onto the surviving record and
 * never delete a purchase or a stock movement. Only an ingredient nothing
 * uses can be deleted (with the undone purchases it leaves behind).
 */

type Actor = { id: string; email: string };
type IngredientCategory = "FOOD" | "PACKAGING" | "SUPPLIES";

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function listSuppliers() {
  const [suppliers, totals, unpaid] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { invoices: true } } } }),
    prisma.purchaseInvoice.groupBy({
      by: ["supplierId"],
      where: { voidedAt: null },
      _sum: { totalFils: true },
      _count: true,
      _max: { invoiceDate: true },
    }),
    prisma.purchaseInvoice.groupBy({
      by: ["supplierId"],
      where: { voidedAt: null, paidAt: null, paymentMode: "credit" },
      _sum: { totalFils: true },
    }),
  ]);
  return suppliers.map(({ _count, ...s }) => {
    const t = totals.find((x) => x.supplierId === s.id);
    return {
      ...s,
      invoiceCount: t?._count ?? 0,
      // Undone invoices too: any invoice keeps the supplier from being deleted.
      allInvoiceCount: _count.invoices,
      spendFils: t?._sum.totalFils ?? 0,
      lastInvoice: t?._max.invoiceDate ?? null,
      owedFils: unpaid.find((x) => x.supplierId === s.id)?._sum.totalFils ?? 0,
    };
  });
}

export async function getSupplier(id: string) {
  return prisma.supplier.findUnique({
    where: { id },
    include: {
      invoices: {
        orderBy: { invoiceDate: "desc" },
        take: 50,
        select: {
          id: true,
          documentId: true,
          voidedDocumentId: true,
          invoiceNo: true,
          invoiceDate: true,
          totalFils: true,
          paymentMode: true,
          paidAt: true,
          dueDate: true,
          voidedAt: true,
        },
      },
      items: { include: { ingredient: { select: { id: true, name: true, unit: true } } }, orderBy: { rawName: "asc" } },
    },
  });
}

export type SupplierUpdate = {
  name: string;
  trn: string | null;
  phone: string | null;
  notes: string | null;
  deliveryDays: number[];
  leadTimeDays: number | null;
  paymentTermsDays: number | null;
};

export async function updateSupplier(id: string, data: SupplierUpdate, actor: Actor) {
  const before = await prisma.supplier.findUnique({ where: { id } });
  if (!before) throw new OpsError("Supplier not found.", 404);
  const after = await prisma.supplier.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: { actor: actor.email, action: "supplier.update", entity: "Supplier", entityId: id, before: pick(before), after: pick(after) },
  });
}

/** A supplier added by hand, before its first invoice (invoices also add them automatically). */
export async function createSupplier(data: SupplierUpdate, actor: Actor) {
  const clash = await prisma.supplier.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } }, select: { name: true } });
  if (clash) throw new OpsError(`"${clash.name}" already exists.`, 409);
  const supplier = await prisma.supplier.create({ data });
  await prisma.auditLog.create({
    data: { actor: actor.email, action: "supplier.create", entity: "Supplier", entityId: supplier.id, after: pick(supplier) },
  });
  return { id: supplier.id, name: supplier.name };
}

/**
 * Only a supplier with no invoices (counted or undone) can be deleted; its
 * learned item names go with it. One with invoices is merged instead.
 */
export async function deleteSupplier(id: string, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const s = await tx.supplier.findUnique({ where: { id }, include: { _count: { select: { invoices: true } } } });
    if (!s) throw new OpsError("Supplier not found.", 404);
    if (s._count.invoices > 0) {
      throw new OpsError("It has invoices, so it is kept for their history. Merge it into another supplier instead.", 409, { kept: { code: "invoices" } });
    }
    await tx.supplier.delete({ where: { id } });
    await tx.auditLog.create({
      data: { actor: actor.email, action: "supplier.delete", entity: "Supplier", entityId: id, before: pick(s) },
    });
  });
}

function pick(s: SupplierUpdate) {
  const { name, trn, phone, notes, deliveryDays, leadTimeDays, paymentTermsDays } = s;
  return { name, trn, phone, notes, deliveryDays, leadTimeDays, paymentTermsDays };
}

/** Moves every invoice and learned item of `fromId` onto `intoId`, then removes `fromId`. */
export async function mergeSuppliers(fromId: string, intoId: string, actor: Actor) {
  if (fromId === intoId) throw new OpsError("Choose a different supplier.");
  return prisma.$transaction(async (tx) => {
    const [from, into] = await Promise.all([
      tx.supplier.findUnique({ where: { id: fromId }, include: { items: true } }),
      tx.supplier.findUnique({ where: { id: intoId }, include: { items: { select: { rawName: true } } } }),
    ]);
    if (!from || !into) throw new OpsError("Supplier not found.", 404);
    const invoices = await tx.purchaseInvoice.updateMany({ where: { supplierId: fromId }, data: { supplierId: intoId } });
    // Learned items: keep the target's memory where both learned the same printed name.
    const known = new Set(into.items.map((i) => i.rawName));
    for (const item of from.items) {
      if (known.has(item.rawName)) await tx.supplierItem.delete({ where: { id: item.id } });
      else await tx.supplierItem.update({ where: { id: item.id }, data: { supplierId: intoId } });
    }
    await tx.supplier.update({
      where: { id: intoId },
      data: { trn: into.trn ?? from.trn, phone: into.phone ?? from.phone },
    });
    await tx.supplier.delete({ where: { id: fromId } });
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "supplier.merge",
        entity: "Supplier",
        entityId: intoId,
        before: { merged: { id: from.id, name: from.name } },
        after: { into: into.name, invoicesMoved: invoices.count },
      },
    });
    return { invoicesMoved: invoices.count };
  });
}

// ─── Ingredients ────────────────────────────────────────────────────────────

export async function getIngredient(id: string) {
  const ingredient = await prisma.ingredient.findUnique({
    where: { id },
    include: {
      // Newest change first: by when it was entered (an invoice saved today
      // for 4 Oct is still the latest change), then by its date.
      movements: { orderBy: [{ createdAt: "desc" }, { at: "desc" }, { id: "desc" }], take: 100 },
      purchaseLines: {
        where: { invoice: { voidedAt: null } },
        orderBy: { invoice: { invoiceDate: "desc" } },
        take: 50,
        include: { invoice: { select: { id: true, documentId: true, invoiceDate: true, supplier: { select: { id: true, name: true } } } } },
      },
    },
  });
  if (!ingredient) return null;
  const onHand = await prisma.stockMovement.aggregate({ where: { ingredientId: id }, _sum: { quantity: true } });
  return { ...ingredient, onHand: onHand._sum.quantity ?? 0 };
}

/** A new food ingredient with no stock yet; it gets a price from its first invoice. */
export async function createIngredient(data: { name: string; nameFa: string | null; unit: "G" | "ML" | "PCS" }, actor: Actor) {
  const clash = await prisma.ingredient.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } } });
  if (clash) {
    if (clash.unit !== data.unit) throw new OpsError(`"${clash.name}" already exists, counted in ${clash.unit.toLowerCase()}.`, 409);
    return { id: clash.id, name: clash.name, nameFa: clash.nameFa, unit: clash.unit };
  }
  const ingredient = await prisma.ingredient.create({ data: { ...data, category: "FOOD" } });
  await prisma.auditLog.create({
    data: { actor: actor.email, action: "ingredient.create", entity: "Ingredient", entityId: ingredient.id, after: data },
  });
  return { id: ingredient.id, name: ingredient.name, nameFa: ingredient.nameFa, unit: ingredient.unit };
}

export async function updateIngredient(
  id: string,
  data: { name: string; nameFa: string | null; category: IngredientCategory; lowStockAt?: number | null },
  actor: Actor,
) {
  const before = await prisma.ingredient.findUnique({ where: { id } });
  if (!before) throw new OpsError("Ingredient not found.", 404);
  const clash = await prisma.ingredient.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, id: { not: id } } });
  if (clash) throw new OpsError(`"${clash.name}" already exists — merge into it instead.`, 409);
  await prisma.ingredient.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: {
      actor: actor.email,
      action: "ingredient.update",
      entity: "Ingredient",
      entityId: id,
      before: { name: before.name, nameFa: before.nameFa, category: before.category, lowStockAt: before.lowStockAt },
      after: data,
    },
  });
}

/** Moves stock, purchases, supplier memory and recipe lines of `fromId` onto `intoId` (same unit), then removes `fromId`. */
export async function mergeIngredients(fromId: string, intoId: string, actor: Actor) {
  if (fromId === intoId) throw new OpsError("Choose a different ingredient.");
  return prisma.$transaction(async (tx) => {
    const [from, into] = await Promise.all([
      tx.ingredient.findUnique({ where: { id: fromId } }),
      tx.ingredient.findUnique({ where: { id: intoId } }),
    ]);
    if (!from || !into) throw new OpsError("Ingredient not found.", 404);
    if (from.unit !== into.unit) throw new OpsError(`Can't merge: ${from.name} is counted in ${from.unit.toLowerCase()}, ${into.name} in ${into.unit.toLowerCase()}.`);
    const moved = await tx.stockMovement.updateMany({ where: { ingredientId: fromId }, data: { ingredientId: intoId } });
    await tx.purchaseLine.updateMany({ where: { ingredientId: fromId }, data: { ingredientId: intoId } });
    await tx.supplierItem.updateMany({ where: { ingredientId: fromId }, data: { ingredientId: intoId } });
    await tx.recipeLine.updateMany({ where: { ingredientId: fromId }, data: { ingredientId: intoId } });
    await tx.recipeNameAlias.updateMany({ where: { ingredientId: fromId }, data: { ingredientId: intoId } });
    await tx.ingredient.update({ where: { id: intoId }, data: { nameFa: into.nameFa ?? from.nameFa } });
    await tx.ingredient.delete({ where: { id: fromId } });
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "ingredient.merge",
        entity: "Ingredient",
        entityId: intoId,
        before: { merged: { id: from.id, name: from.name } },
        after: { into: into.name, movementsMoved: moved.count },
      },
    });
  });
}

/**
 * Counts an ingredient in another unit (oil bought "per tin" but used in
 * grams). Everything already recorded in the old unit is converted by
 * `factor` — new units per old unit (1 pc = 18 000 g → 18000) — so stock,
 * purchases, the supplier's learned pack sizes, recipe lines and the
 * low-stock warning keep their meaning. Money is untouched: each entry
 * keeps its cost, so the price per unit follows. Audited with the factor.
 */
export async function changeIngredientUnit(id: string, unit: "G" | "ML" | "PCS", factor: number, actor: Actor) {
  if (!(factor > 0) || !Number.isFinite(factor)) throw new OpsError("Enter how much one old unit is in the new unit.");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Ingredient" WHERE "id" = ${id} FOR UPDATE`;
    const before = await tx.ingredient.findUnique({ where: { id }, select: { name: true, unit: true, lowStockAt: true } });
    if (!before) throw new OpsError("Ingredient not found.", 404);
    if (before.unit === unit) throw new OpsError("It is already counted in that unit.");

    const scale = (table: string, column: string, where: string) =>
      tx.$executeRawUnsafe(`UPDATE "${table}" SET "${column}" = "${column}" * $1 WHERE ${where} = $2`, factor, id);
    const counts = {
      stockMovements: await scale("StockMovement", "quantity", `"ingredientId"`),
      purchaseLines: await scale("PurchaseLine", "baseQty", `"ingredientId"`),
      supplierItems: await scale("SupplierItem", "baseQtyPerUnit", `"ingredientId"`),
      recipeLines: await scale("RecipeLine", "quantity", `"ingredientId"`),
    };
    await tx.ingredient.update({ where: { id }, data: { unit, lowStockAt: before.lowStockAt == null ? null : before.lowStockAt * factor } });
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "ingredient.unit",
        entity: "Ingredient",
        entityId: id,
        before: { unit: before.unit, lowStockAt: before.lowStockAt },
        after: { unit, factor, converted: counts },
      },
    });
    return counts;
  });
}

// ─── Deleting unused ingredients ────────────────────────────────────────────

/** Why an ingredient has to stay, or null when it can be deleted. */
export type KeptReason =
  | { code: "recipes"; names: string[] }
  | { code: "recipeHistory"; names: string[] }
  | { code: "invoice" }
  | { code: "sales" }
  | { code: "owner" }
  | { code: "history" };

const usageSelect = {
  id: true,
  name: true,
  recipeLines: { select: { version: { select: { status: true, recipe: { select: { name: true } }, _count: { select: { stockUses: true } } } } } },
  // Lines of undone invoices don't count: the invoice keeps them, without the link.
  purchaseLines: { where: { invoice: { voidedAt: null } }, select: { id: true }, take: 1 },
  movements: {
    select: {
      id: true,
      type: true,
      quantity: true,
      at: true,
      note: true,
      orderId: true,
      platformOrderId: true,
      freeFoodId: true,
      reversesId: true,
      reversedBy: { select: { id: true } },
    },
  },
} as const;

type Movement = {
  type: string;
  quantity: number;
  at: Date;
  note: string | null;
  orderId: string | null;
  platformOrderId: string | null;
  freeFoodId: string | null;
  reversesId: string | null;
  reversedBy: unknown;
};
type Usage = {
  recipeLines: { version: { status: string; recipe: { name: string }; _count: { stockUses: number } } }[];
  purchaseLines: unknown[];
  movements: Movement[];
};

/** Entries that aren't a "bought, then the invoice was undone" pair. */
const realEntries = (ms: Movement[]) => ms.filter((m) => !m.reversesId && !m.reversedBy);

const recipeNames = (lines: Usage["recipeLines"]) => [...new Set(lines.map((l) => l.version.recipe.name))].sort();

/**
 * Anyone may delete an ingredient with no real stock entries. The owner may
 * also delete one whose manual entries (waste, corrections, counts) add up
 * to zero — never one a sale or free food took stock from.
 *
 * Recipes: only a current version (approved or draft) keeps it, or an old
 * (retired) version that sales were costed with. Old versions nothing used
 * are editing history; they lose the line when it is deleted.
 */
function keptReason(i: Usage, owner: boolean): KeptReason | null {
  const current = i.recipeLines.filter((l) => l.version.status !== "RETIRED");
  if (current.length) return { code: "recipes", names: recipeNames(current) };
  const sold = i.recipeLines.filter((l) => l.version._count.stockUses > 0);
  if (sold.length) return { code: "recipeHistory", names: recipeNames(sold) };
  if (i.purchaseLines.length) return { code: "invoice" };
  const real = realEntries(i.movements);
  if (!real.length) return null;
  if (real.some((m) => m.type === "CONSUMPTION" || m.orderId || m.platformOrderId || m.freeFoodId)) return { code: "sales" };
  const total = i.movements.reduce((sum, m) => sum + m.quantity, 0);
  if (Math.abs(total) > 1e-9) return { code: "history" };
  return owner ? null : { code: "owner" };
}

const KEPT_MESSAGE = {
  recipes: (names: string[]) => `It is used in ${names.join(", ")}. Remove it from those recipes first.`,
  recipeHistory: (names: string[]) => `Earlier versions of ${names.join(", ")} used it for sales, so it is kept for their history. Merge it into another ingredient instead.`,
  invoice: () => "It is on an invoice that still counts. Undo that invoice first, or merge this ingredient into another.",
  sales: () => "Sales or free food took stock from it, so it is kept for their history. Merge it into another ingredient instead.",
  owner: () => "Only the owner can delete it: it has waste or correction entries (they add up to zero).",
  history: () => "It has stock history (opening stock, counts, waste or sales). Merge it into another ingredient instead.",
};

/** Why each ingredient has to stay (missing: it can be deleted), for the Stock list. */
export async function ingredientKeptReasons(owner: boolean) {
  const all = await prisma.ingredient.findMany({ select: usageSelect });
  return new Map(all.flatMap((i) => {
    const kept = keptReason(i, owner);
    return kept ? [[i.id, kept] as const] : [];
  }));
}

/** Whether `id` can be deleted by this person, for its page. */
export async function ingredientKeptReason(id: string, owner: boolean) {
  const i = await prisma.ingredient.findUnique({ where: { id }, select: usageSelect });
  return i ? keptReason(i, owner) : null;
}

/** Ingredients nothing depends on any more, e.g. left over from undone invoices (no manual entries either). */
export async function unusedIngredients() {
  const all = await prisma.ingredient.findMany({ select: usageSelect, orderBy: { name: "asc" } });
  return all.filter((i) => !keptReason(i, false)).map((i) => ({ id: i.id, name: i.name }));
}

async function deleteOne(tx: Prisma.TransactionClient, id: string, actor: Actor, via: string, owner: boolean) {
  const i = await tx.ingredient.findUnique({ where: { id }, select: { ...usageSelect, nameFa: true, unit: true, category: true } });
  if (!i) throw new OpsError("Ingredient not found.", 404);
  const kept = keptReason(i, owner);
  if (kept) throw new OpsError(kept.code === "recipes" || kept.code === "recipeHistory" ? KEPT_MESSAGE[kept.code](kept.names) : KEPT_MESSAGE[kept.code](), 409, { kept });
  // Old recipe versions no sale used lose the line (kept in the audit entry below).
  const oldLines = await tx.recipeLine.findMany({
    where: { ingredientId: id },
    select: { id: true, quantity: true, version: { select: { number: true, recipe: { select: { name: true } } } } },
  });
  await tx.recipeLine.deleteMany({ where: { id: { in: oldLines.map((l) => l.id) } } });
  // Undo entries first: each points at the entry it cancels.
  await tx.stockMovement.deleteMany({ where: { ingredientId: id, reversesId: { not: null } } });
  await tx.stockMovement.deleteMany({ where: { ingredientId: id } });
  // Supplier name memory and recipe-sheet aliases go with it; undone invoices keep their lines (unlinked).
  await tx.ingredient.delete({ where: { id } });
  await tx.auditLog.create({
    data: {
      actor: actor.email,
      action: "ingredient.delete",
      entity: "Ingredient",
      entityId: id,
      via,
      before: {
        name: i.name,
        nameFa: i.nameFa,
        unit: i.unit,
        category: i.category,
        undoneMovementsRemoved: i.movements.length - realEntries(i.movements).length,
        oldRecipeLinesRemoved: oldLines.map((l) => ({ recipe: l.version.recipe.name, version: l.version.number, quantity: l.quantity })),
        // The manual entries removed with it, so they can still be looked up.
        manualEntriesRemoved: realEntries(i.movements).map((m) => ({ type: m.type, quantity: m.quantity, at: m.at.toISOString(), note: m.note })),
      },
    },
  });
  return i.name;
}

/** Deletes an ingredient nothing uses; otherwise says what still needs it. */
export async function deleteIngredient(id: string, actor: Actor, via = "manual", opts: { owner?: boolean } = {}) {
  return prisma.$transaction((tx) => deleteOne(tx, id, actor, via, !!opts.owner));
}

/**
 * Deletes every ingredient nothing uses, each in its own transaction (one
 * for all of them runs past the transaction time limit on the hosted
 * database). One that got used meanwhile is skipped and reported.
 */
export async function deleteUnusedIngredients(actor: Actor, via = "manual") {
  const deleted: string[] = [];
  const skipped: string[] = [];
  for (const { id, name } of await unusedIngredients()) {
    try {
      deleted.push(await deleteIngredient(id, actor, via));
    } catch (e) {
      if (!(e instanceof OpsError)) throw e;
      skipped.push(name);
    }
  }
  return { deleted, skipped };
}

// ─── Manual stock movements ─────────────────────────────────────────────────

export const MANUAL_MOVEMENTS = ["WASTE", "STAFF_MEAL", "ADJUSTMENT"] as const;

/** Waste and staff meals take stock out; an adjustment may go either way. */
export async function addMovement(
  ingredientId: string,
  input: { type: (typeof MANUAL_MOVEMENTS)[number]; quantity: number; day: string; note: string | null },
  actor: Actor,
  via = "manual",
) {
  const quantity = input.type === "ADJUSTMENT" ? input.quantity : -Math.abs(input.quantity);
  if (quantity === 0) throw new OpsError("Enter an amount.");
  const m = await prisma.stockMovement.create({
    data: { ingredientId, type: input.type, quantity, at: dubaiDate(input.day), note: input.note, createdById: actor.id },
  });
  await prisma.auditLog.create({
    data: { actor: actor.email, action: "stock.movement", entity: "StockMovement", entityId: m.id, via, after: { ingredientId, type: input.type, quantity, note: input.note } },
  });
  return { id: m.id };
}

/**
 * A stock count: for each counted ingredient, a COUNT movement for the
 * difference between what the ledger says and what is on the shelf.
 */
export async function recordCount(counts: { ingredientId: string; counted: number }[], day: string, actor: Actor, via = "manual") {
  return prisma.$transaction(async (tx) => {
    // Lock the counted ingredients (in a fixed order, so two counts can't
    // deadlock) until this transaction ends: a second count of the same
    // item waits, then sees this one's movement instead of posting the
    // same difference again.
    const ids = [...new Set(counts.map((c) => c.ingredientId))].sort();
    await tx.$queryRaw`SELECT "id" FROM "Ingredient" WHERE "id" = ANY(${ids}::text[]) ORDER BY "id" FOR UPDATE`;
    const sums = await tx.stockMovement.groupBy({
      by: ["ingredientId"],
      where: { ingredientId: { in: counts.map((c) => c.ingredientId) } },
      _sum: { quantity: true },
    });
    const at = dubaiDate(day);
    const changes: { ingredientId: string; from: number; to: number }[] = [];
    const movementIds: string[] = [];
    for (const c of counts) {
      const ledger = sums.find((s) => s.ingredientId === c.ingredientId)?._sum.quantity ?? 0;
      const diff = c.counted - ledger;
      if (Math.abs(diff) < 1e-9) continue;
      const m = await tx.stockMovement.create({
        data: { ingredientId: c.ingredientId, type: "COUNT", quantity: diff, at, note: `Counted ${c.counted}`, createdById: actor.id },
      });
      movementIds.push(m.id);
      changes.push({ ingredientId: c.ingredientId, from: ledger, to: c.counted });
    }
    await tx.auditLog.create({
      data: { actor: actor.email, action: "stock.count", entity: "StockCount", entityId: day, via, after: { counted: counts.length, changed: changes } },
    });
    return { counted: counts.length, changed: changes.length, movementIds };
  });
}

// ─── Payables ───────────────────────────────────────────────────────────────

export async function listPayables() {
  const [open, recent] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: { voidedAt: null, paidAt: null, paymentMode: "credit" },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { invoiceDate: "asc" }],
      include: { supplier: { select: { id: true, name: true } } },
    }),
    prisma.purchaseInvoice.findMany({
      where: { voidedAt: null, paidAt: { not: null }, paymentMode: "credit" },
      orderBy: { paidAt: "desc" },
      take: 20,
      include: { supplier: { select: { id: true, name: true } } },
    }),
  ]);
  return { open, recent };
}

// ─── Supplier statements ────────────────────────────────────────────────────

const invoiceKey = (no: string) => no.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Compares a supplier's statement of account with the invoices saved for
 * that supplier: which are saved, which were saved under a different
 * (misread) number — same amount within a day — and which are missing.
 */
export async function reconcileStatement(
  statement: { supplierName: string | null; supplierId: string | null; lines: { invoiceNo: string; date: string | null; amount: number | null }[] },
) {
  const supplier = statement.supplierId
    ? await prisma.supplier.findUnique({ where: { id: statement.supplierId }, select: { id: true, name: true } })
    : statement.supplierName
      ? await prisma.supplier.findFirst({ where: { name: { equals: statement.supplierName, mode: "insensitive" } }, select: { id: true, name: true } })
      : null;
  const saved = supplier
    ? await prisma.purchaseInvoice.findMany({
        where: { supplierId: supplier.id, voidedAt: null },
        select: { id: true, documentId: true, invoiceNo: true, invoiceDate: true, totalFils: true, paidAt: true },
      })
    : [];
  const used = new Set<string>();
  const rows = statement.lines.map((l) => {
    const amountFils = l.amount == null ? null : Math.round(l.amount * 100);
    let match = saved.find((s) => !used.has(s.id) && s.invoiceNo && invoiceKey(s.invoiceNo) === invoiceKey(l.invoiceNo));
    let how: "number" | "amount" | null = match ? "number" : null;
    if (!match && amountFils != null) {
      const day = l.date ? Date.parse(l.date) : null;
      match = saved.find(
        (s) => !used.has(s.id) && s.totalFils === amountFils && (day == null || Math.abs(s.invoiceDate.getTime() - day) <= 1.5 * 86_400_000),
      );
      if (match) how = "amount";
    }
    if (match) used.add(match.id);
    return { ...l, amountFils, match: match ?? null, how };
  });
  return { supplier, rows };
}

// ─── Opening stock ──────────────────────────────────────────────────────────

const DB_UNIT = { g: "G", ml: "ML", pcs: "PCS" } as const;

/**
 * What was already in the kitchen on the first day: one OPENING movement
 * per ingredient (with its value when known), dated at the very start of
 * that day so the month's invoices come after it. An ingredient gets one
 * opening only; later differences are counts or corrections.
 */
export async function recordOpeningStock(
  day: string,
  rows: { ingredientId: string | null; name: string; unit: "g" | "ml" | "pcs"; category: IngredientCategory; quantity: number; value: number | null }[],
  actor: Actor,
) {
  return prisma.$transaction(async (tx) => {
    const at = new Date(`${day}T00:00:00+04:00`);
    const done: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const unit = DB_UNIT[row.unit];
      let ingredient = row.ingredientId
        ? await tx.ingredient.findUnique({ where: { id: row.ingredientId } })
        : await tx.ingredient.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });
      if (!ingredient) {
        ingredient = await tx.ingredient.create({ data: { name: row.name, unit, category: row.category } });
      }
      if (ingredient.unit !== unit) {
        throw new OpsError(`"${ingredient.name}" is counted in ${ingredient.unit.toLowerCase()}, not ${row.unit}.`);
      }
      if (seen.has(ingredient.id)) throw new OpsError(`"${ingredient.name}" is in the list twice.`);
      seen.add(ingredient.id);
      const existing = await tx.stockMovement.findFirst({ where: { ingredientId: ingredient.id, type: "OPENING" }, select: { id: true } });
      if (existing) {
        throw new OpsError(`"${ingredient.name}" already has an opening stock — use a stock count or a correction instead.`, 409);
      }
      await tx.stockMovement.create({
        data: {
          ingredientId: ingredient.id,
          type: "OPENING",
          quantity: row.quantity,
          costFils: row.value == null ? null : Math.round(row.value * 100),
          at,
          note: "Opening stock",
          createdById: actor.id,
        },
      });
      done.push({ id: ingredient.id, name: ingredient.name });
    }
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "stock.opening",
        entity: "StockOpening",
        entityId: day,
        after: { day, items: rows.length, value: rows.reduce((s, r) => s + (r.value ?? 0), 0) },
      },
    });
    return { saved: done.length };
  });
}
