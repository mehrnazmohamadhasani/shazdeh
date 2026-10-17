import "server-only";
import { prisma } from "@/lib/prisma";
import { OpsError, dubaiDate } from "./documents";
import { approvedDishCosts } from "./recipes";
import { recordSaleUse, reverseSaleUse } from "./stock-use";
import { checkDay } from "./assistant/match";
import { FREE_FOOD_LABEL, freeFoodTotals, summariseFreeFood, type FreeFoodInput, type FreeFoodKind } from "./free-food-shared";

/*
 * Recording free food: dishes given away or eaten by the team. Each dish
 * takes its ingredients out of stock through the approved recipe (as
 * STAFF_MEAL or GIFT movements, never as a sale) and keeps what it cost
 * and what it sells for at that moment, so later price changes don't
 * rewrite it. A dish with no approved recipe is still recorded, takes no
 * stock and has an unknown cost — never a guessed one. Deleting puts the
 * stock back; editing deletes and records again. Deleted records stay in
 * the database (and audit log) but leave the list.
 */

type Actor = { id: string; email: string };
const DAY_MS = 86_400_000;
/** Today in Dubai (UTC+4, no DST); kept here so Today can import this file without a cycle. */
const dubaiToday = () => new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10);

/** The dishes, with their cost and menu price as of now. */
export async function priceFreeFood(items: FreeFoodInput["items"]) {
  const ids = [...new Set(items.map((i) => i.menuItemId))];
  const [menu, costs] = await Promise.all([
    prisma.menuItem.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, nameFa: true, price: true } }),
    approvedDishCosts(new Date()),
  ]);
  const lines = items.map((i) => {
    const m = menu.find((x) => x.id === i.menuItemId);
    if (!m) throw new OpsError("A dish on this list is no longer on the menu.", 404);
    const cost = costs.get(m.id);
    return {
      menuItemId: m.id,
      name: m.name,
      nameFa: m.nameFa,
      quantity: i.quantity,
      unitCostFils: cost?.ok ? Math.round(cost.perPortionFils) : null,
      /** Why the cost is unknown (no recipe, not approved, no price). */
      costGap: cost?.ok ? null : (cost?.reason ?? "no_recipe"),
      menuPriceFils: Math.round(m.price * 100),
    };
  });
  return { lines, ...freeFoodTotals(lines) };
}

function dayOf(asked: string | null) {
  const d = checkDay(asked, dubaiToday());
  if (!d.ok) throw new OpsError(d.error);
  return d.day;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Priced = Awaited<ReturnType<typeof priceFreeFood>>;

/** Writes one record, takes its stock by recipe and audits it — inside the caller's transaction. */
async function insertFreeFood(
  tx: Tx,
  input: FreeFoodInput,
  priced: Priced,
  at: Date,
  actor: Actor,
  opts: { via: string; sourceDocumentId: string | null; action: "free_food.create" | "free_food.edit"; replaces?: string },
) {
  const record = await tx.freeFood.create({
    data: {
      kind: input.kind,
      at,
      recipient: input.recipient || null,
      reason: input.reason || null,
      costFils: priced.costFils,
      menuValueFils: priced.menuValueFils,
      via: opts.via,
      sourceDocumentId: opts.sourceDocumentId,
      createdById: actor.id,
      items: {
        create: priced.lines.map((l) => ({ menuItemId: l.menuItemId, name: l.name, quantity: l.quantity, unitCostFils: l.unitCostFils, menuPriceFils: l.menuPriceFils })),
      },
    },
  });
  const label = `${FREE_FOOD_LABEL[input.kind]}${input.recipient ? ` (${input.recipient})` : ""}`;
  const stock = await recordSaleUse(
    tx,
    { freeFoodId: record.id },
    { at, label, items: priced.lines.map((l) => ({ menuItemId: l.menuItemId, name: l.name, quantity: l.quantity })), actorId: actor.id },
    input.kind === "STAFF_MEAL" ? "STAFF_MEAL" : "GIFT",
  );
  await tx.auditLog.create({
    data: {
      actor: actor.email,
      action: opts.action,
      entity: "FreeFood",
      entityId: record.id,
      via: opts.via,
      after: {
        kind: input.kind,
        day: new Date(at.getTime() + 4 * 3_600_000).toISOString().slice(0, 10),
        recipient: input.recipient,
        dishes: priced.lines.map((l) => `${l.quantity}× ${l.name}`),
        costFils: priced.costFils,
        menuValueFils: priced.menuValueFils,
        stockSkipped: stock.skipped.map((s) => s.name),
        ...(opts.replaces ? { replaces: opts.replaces } : {}),
        ...(opts.sourceDocumentId ? { sourceDocumentId: opts.sourceDocumentId } : {}),
      },
    },
  });
  return { id: record.id, costFils: priced.costFils, menuValueFils: priced.menuValueFils, skipped: stock.skipped };
}

/** Marks a record deleted and puts its stock back (inside the caller's transaction). */
async function removeFreeFood(tx: Tx, id: string, actor: Actor, via: string, note: string) {
  const claimed = await tx.freeFood.updateMany({ where: { id, voidedAt: null }, data: { voidedAt: new Date() } });
  if (claimed.count === 0) throw new OpsError((await tx.freeFood.count({ where: { id } })) ? "Already deleted." : "Not found.", 409);
  const reversed = await reverseSaleUse(tx, { freeFoodId: id }, note, actor.id);
  await tx.auditLog.create({
    data: { actor: actor.email, action: "free_food.delete", entity: "FreeFood", entityId: id, via, after: { stockMovementsReversed: reversed } },
  });
}

export async function recordFreeFood(input: FreeFoodInput, actor: Actor, opts: { via?: string; sourceDocumentId?: string | null } = {}) {
  const day = dayOf(input.day);
  const priced = await priceFreeFood(input.items);
  // Today: now. An earlier day: that day at noon (Dubai), like other back-dated entries.
  const at = day === dubaiToday() ? new Date() : dubaiDate(day);
  return prisma.$transaction((tx) =>
    insertFreeFood(tx, input, priced, at, actor, { via: opts.via ?? "manual", sourceDocumentId: opts.sourceDocumentId ?? null, action: "free_food.create" }),
  );
}

/**
 * Edits a record: the old one is deleted (its stock comes back) and the
 * corrected one takes its place, at the same moment unless the day
 * changed. Both stay in the history, linked in the audit log.
 */
export async function editFreeFood(id: string, input: FreeFoodInput, actor: Actor, via = "manual") {
  const old = await prisma.freeFood.findUnique({ where: { id }, select: { at: true, voidedAt: true, sourceDocumentId: true } });
  if (!old || old.voidedAt) throw new OpsError("This record was deleted, so it can't be edited.", 409);
  const day = dayOf(input.day);
  const sameDay = new Date(old.at.getTime() + 4 * 3_600_000).toISOString().slice(0, 10) === day;
  const at = sameDay ? old.at : day === dubaiToday() ? new Date() : dubaiDate(day);
  const priced = await priceFreeFood(input.items);
  return prisma.$transaction(async (tx) => {
    await removeFreeFood(tx, id, actor, via, "Free food edited");
    return insertFreeFood(tx, input, priced, at, actor, { via, sourceDocumentId: old.sourceDocumentId, action: "free_food.edit", replaces: id });
  });
}

/** Deletes a record: its stock comes back; the record stays in the history, hidden from the list. */
export async function voidFreeFood(id: string, actor: Actor, via = "manual") {
  return prisma.$transaction((tx) => removeFreeFood(tx, id, actor, via, "Free food deleted"));
}

/** Free food in [from, to) that wasn't deleted, newest first, with its dishes. */
export async function listFreeFood(from: Date, to: Date) {
  return prisma.freeFood.findMany({
    where: { at: { gte: from, lt: to }, voidedAt: null },
    orderBy: { at: "desc" },
    include: { items: { select: { name: true, quantity: true, unitCostFils: true, menuPriceFils: true, menuItem: { select: { nameFa: true } } } } },
  });
}

/** One Dubai day's free food (not undone), by kind — for Today. */
export async function freeFoodOnDay(day: string) {
  const from = new Date(`${day}T00:00:00+04:00`);
  const rows = await prisma.freeFood.findMany({
    where: { at: { gte: from, lt: new Date(from.getTime() + DAY_MS) }, voidedAt: null },
    select: { kind: true, costFils: true, menuValueFils: true, items: { select: { quantity: true } } },
  });
  return summariseFreeFood(
    rows.map((r) => ({ kind: r.kind as FreeFoodKind, costFils: r.costFils, menuValueFils: r.menuValueFils, portions: r.items.reduce((s, i) => s + i.quantity, 0) })),
  );
}

/** One record, in the shape the form edits; null when missing or deleted. */
export async function getFreeFoodForEdit(id: string) {
  const r = await prisma.freeFood.findUnique({ where: { id }, include: { items: { select: { menuItemId: true, quantity: true } } } });
  if (!r || r.voidedAt) return null;
  return {
    id: r.id,
    kind: r.kind as FreeFoodKind,
    day: new Date(r.at.getTime() + 4 * 3_600_000).toISOString().slice(0, 10),
    recipient: r.recipient,
    reason: r.reason,
    // Dishes since taken off the menu can't be picked again; the form shows the rest.
    items: r.items.flatMap((i) => (i.menuItemId ? [{ menuItemId: i.menuItemId, quantity: i.quantity }] : [])),
  };
}
