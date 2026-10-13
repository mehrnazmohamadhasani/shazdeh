import "server-only";
import { prisma } from "@/lib/prisma";
import { OpsError, dubaiDate } from "./documents";

/*
 * Suppliers, ingredients, manual stock movements and payables. Every
 * change is audited; merges move history onto the surviving record and
 * never delete a purchase or a stock movement.
 */

type Actor = { id: string; email: string };

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function listSuppliers() {
  const [suppliers, totals, unpaid] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
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
  return suppliers.map((s) => {
    const t = totals.find((x) => x.supplierId === s.id);
    return {
      ...s,
      invoiceCount: t?._count ?? 0,
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
      movements: { orderBy: { at: "desc" }, take: 100 },
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

export async function updateIngredient(
  id: string,
  data: { name: string; nameFa: string | null; category: "FOOD" | "PACKAGING" },
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
      before: { name: before.name, nameFa: before.nameFa, category: before.category },
      after: data,
    },
  });
}

/** Moves stock, purchases and supplier memory of `fromId` onto `intoId` (same unit), then removes `fromId`. */
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

// ─── Manual stock movements ─────────────────────────────────────────────────

export const MANUAL_MOVEMENTS = ["WASTE", "STAFF_MEAL", "ADJUSTMENT"] as const;

/** Waste and staff meals take stock out; an adjustment may go either way. */
export async function addMovement(
  ingredientId: string,
  input: { type: (typeof MANUAL_MOVEMENTS)[number]; quantity: number; day: string; note: string | null },
  actor: Actor,
) {
  const quantity = input.type === "ADJUSTMENT" ? input.quantity : -Math.abs(input.quantity);
  if (quantity === 0) throw new OpsError("Enter an amount.");
  const m = await prisma.stockMovement.create({
    data: { ingredientId, type: input.type, quantity, at: dubaiDate(input.day), note: input.note, createdById: actor.id },
  });
  await prisma.auditLog.create({
    data: { actor: actor.email, action: "stock.movement", entity: "StockMovement", entityId: m.id, after: { ingredientId, type: input.type, quantity, note: input.note } },
  });
}

/**
 * A stock count: for each counted ingredient, a COUNT movement for the
 * difference between what the ledger says and what is on the shelf.
 */
export async function recordCount(counts: { ingredientId: string; counted: number }[], day: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const sums = await tx.stockMovement.groupBy({
      by: ["ingredientId"],
      where: { ingredientId: { in: counts.map((c) => c.ingredientId) } },
      _sum: { quantity: true },
    });
    const at = dubaiDate(day);
    const changes: { ingredientId: string; from: number; to: number }[] = [];
    for (const c of counts) {
      const ledger = sums.find((s) => s.ingredientId === c.ingredientId)?._sum.quantity ?? 0;
      const diff = c.counted - ledger;
      if (Math.abs(diff) < 1e-9) continue;
      await tx.stockMovement.create({
        data: { ingredientId: c.ingredientId, type: "COUNT", quantity: diff, at, note: `Counted ${c.counted}`, createdById: actor.id },
      });
      changes.push({ ingredientId: c.ingredientId, from: ledger, to: c.counted });
    }
    await tx.auditLog.create({
      data: { actor: actor.email, action: "stock.count", entity: "StockCount", entityId: day, after: { counted: counts.length, changed: changes } },
    });
    return { counted: counts.length, changed: changes.length };
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
