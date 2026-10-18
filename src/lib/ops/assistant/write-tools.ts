import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { addMovement, recordCount } from "../catalog";
import { OpsError, editInvoice, saveDocument } from "../documents";
import { approveDraftTx, deleteRecipe, discardDraft, previewNewRecipeCost, previewRecipeCost, writeDraft, type DraftLineInput } from "../recipes";
import { dishMargin } from "../recipe-cost";
import type { SaveInvoiceInput } from "../save-schema";
import { itemRef, lastPrices, onHand, pick, valueOf, type Catalog } from "./catalog";
import { bigCountDifference, checkDay, findByName, normalizeText, toStockUnit, type Named } from "./match";
import { fixUnitPrice } from "./invoice-fix";
import type { toolArgs } from "./definitions";
import { priceFreeFood, recordFreeFood, voidFreeFood } from "../free-food";
import type { CountPreview, FreeFoodPreview, InvoicePreview, NewRecipePreview, Preview, RecipePreview, StockPreview, WriteTool } from "./types";

/*
 * The assistant's changes, in three steps that never mix:
 *
 *   build   — the model's arguments → a checked input with names resolved
 *             to ids (nothing is written);
 *   preview — the input → what the person sees before/after, worked out
 *             from the data as it is now (run again on confirm, so a card
 *             that went stale is shown again instead of applied);
 *   apply / undo — through the same ops functions the screens use, each
 *             of which writes its own AuditLog row with via "chat"/"voice".
 */

type Args<K extends keyof typeof toolArgs> = z.infer<(typeof toolArgs)[K]>;
type Actor = { id: string; email: string; role: string };

export type StoredInput =
  | { tool: "record_waste" | "record_staff_meal" | "adjust_stock"; ingredientId: string; type: StockPreview["type"]; quantity: number; day: string; note: string | null }
  | { tool: "stock_count"; day: string; counts: { ingredientId: string; counted: number }[] }
  | {
      tool: "change_recipe";
      recipeId: string;
      fromVersionId: string;
      approve: boolean;
      note: string | null;
      lines: DraftLineInput[];
      changes: RecipePreview["changes"];
    }
  | {
      tool: "write_recipe";
      menuItemId: string;
      /** The dish's recipe if it exists already (an empty one); null: created on confirm. */
      recipeId: string | null;
      portions: number;
      note: string | null;
      lines: DraftLineInput[];
      rows: NewRecipePreview["rows"];
    }
  | { tool: "fix_invoice_price"; invoiceId: string; lineId: string; unitPriceFils: number }
  | {
      tool: "record_free_food";
      kind: FreeFoodPreview["type"];
      day: string;
      recipient: string | null;
      reason: string | null;
      items: { menuItemId: string; quantity: number }[];
    };

const UNIT_WORD = { G: "grams", ML: "millilitres", PCS: "pieces" } as const;

function amountIn(item: { name: string; unit: "G" | "ML" | "PCS" }, quantity: number, unit: Args<"record_waste">["unit"]) {
  const q = toStockUnit(quantity, unit, item.unit);
  if (q == null) throw new OpsError(`${item.name} is counted in ${UNIT_WORD[item.unit]}, not ${unit}. Ask how much in ${UNIT_WORD[item.unit]}.`);
  return q;
}

function day(asked: string | null, today: string) {
  const d = checkDay(asked, today);
  if (!d.ok) throw new OpsError(d.error);
  return d.day;
}

// ─── Build ──────────────────────────────────────────────────────────────────

export async function build(tool: WriteTool, raw: unknown, catalog: Catalog, actor: Actor, today: string): Promise<StoredInput> {
  switch (tool) {
    case "record_waste":
    case "record_staff_meal": {
      const args = raw as Args<"record_waste">;
      const item = pick("Ingredient", args.item, catalog.ingredients);
      const q = amountIn(item, args.quantity, args.unit);
      return { tool, ingredientId: item.id, type: tool === "record_waste" ? "WASTE" : "STAFF_MEAL", quantity: -Math.abs(q), day: day(args.day, today), note: args.note?.trim() || null };
    }
    case "adjust_stock": {
      const args = raw as Args<"adjust_stock">;
      const item = pick("Ingredient", args.item, catalog.ingredients);
      return { tool, ingredientId: item.id, type: "ADJUSTMENT", quantity: amountIn(item, args.quantity, args.unit), day: today, note: args.reason.trim() };
    }
    case "stock_count": {
      const args = raw as Args<"stock_count">;
      const counted = new Map<string, number>();
      for (const c of args.counts) {
        const item = pick("Ingredient", c.item, catalog.ingredients);
        counted.set(item.id, amountIn(item, c.quantity, c.unit));
      }
      return { tool, day: day(args.day, today), counts: [...counted].map(([ingredientId, n]) => ({ ingredientId, counted: n })) };
    }
    case "change_recipe":
      return buildRecipe(raw as Args<"change_recipe">, catalog, actor);
    case "write_recipe":
      return buildNewRecipe(raw as Args<"write_recipe">, catalog);
    case "fix_invoice_price":
      return buildInvoiceFix(raw as Args<"fix_invoice_price">, catalog, today);
    case "record_free_food": {
      const args = raw as Args<"record_free_food">;
      const portions = new Map<string, number>();
      for (const i of args.items) {
        const dish = pick("Dish", i.dish, catalog.menuItems);
        portions.set(dish.id, (portions.get(dish.id) ?? 0) + i.quantity);
      }
      return {
        tool,
        kind: args.kind,
        day: day(args.day, today),
        recipient: args.recipient?.trim() || null,
        reason: args.reason?.trim() || null,
        items: [...portions].map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      };
    }
  }
}

async function buildRecipe(args: Args<"change_recipe">, catalog: Catalog, actor: Actor): Promise<StoredInput> {
  const first = await asFirstRecipe(args, catalog);
  if (first) return first;
  const entry = pick("Recipe", args.recipe, catalog.recipes);
  const versions = await prisma.recipeVersion.findMany({
    where: { recipeId: entry.id, status: { in: ["APPROVED", "DRAFT"] } },
    include: { lines: { orderBy: { order: "asc" } } },
  });
  const approved = versions.find((v) => v.status === "APPROVED");
  if (!approved) throw new OpsError(`${entry.name} has no approved recipe yet. Write and approve it on the recipe screen first.`, 409);
  if (versions.some((v) => v.status === "DRAFT")) {
    throw new OpsError(`${entry.name} already has an unapproved draft. Approve or discard it on the recipe screen first, so it isn't overwritten.`, 409);
  }

  // What a change may name: an ingredient, or a prep (not the recipe itself).
  const sources = await recipeSources(catalog, entry.id);

  const lines: DraftLineInput[] = approved.lines.map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: l.quantity, wastePct: l.wastePct, note: l.note }));
  const changes: RecipePreview["changes"] = [];
  for (const c of args.changes) {
    // Prefer what is already on the recipe: "beef" here means the beef it uses.
    const onRecipe = sources.filter((s) => lines.some((l) => (s.kind === "ingredient" ? l.ingredientId : l.subRecipeId) === s.id));
    const hit = findByName(c.item, onRecipe);
    const source = hit.ok ? hit.item : pick("Ingredient or prep", c.item, sources);
    const at = lines.findIndex((l) => (source.kind === "ingredient" ? l.ingredientId : l.subRecipeId) === source.id);
    const before = at >= 0 ? lines[at].quantity : null;
    let after: number | null = null;
    if (c.quantity == null) {
      if (at < 0) throw new OpsError(`${source.name} is not on ${entry.name}, so it can't be removed.`);
      lines.splice(at, 1);
    } else {
      after = amountIn(source, c.quantity, c.unit);
      if (after <= 0) throw new OpsError("Use a quantity above 0, or say remove.");
      if (at >= 0) lines[at] = { ...lines[at], quantity: after };
      else lines.push({ ingredientId: source.kind === "ingredient" ? source.id : null, subRecipeId: source.kind === "prep" ? source.id : null, quantity: after, wastePct: 0, note: null });
    }
    changes.push({ item: { name: source.name, nameFa: source.nameFa }, unit: source.unit, before, after });
  }
  if (lines.length === 0) throw new OpsError("A recipe needs at least one ingredient.");
  return { tool: "change_recipe", recipeId: entry.id, fromVersionId: approved.id, approve: actor.role === "ADMIN", note: args.note?.trim() || null, lines, changes };
}

/**
 * "Add 5 g salt to test2" for a menu dish with no recipe yet (or only an
 * empty draft): there is nothing to change, so it becomes the dish's first
 * recipe (write_recipe). A recipe with exactly the name said still wins,
 * so a prep or dish with a recipe is changed as before. Null: not this case.
 */
async function asFirstRecipe(args: Args<"change_recipe">, catalog: Catalog): Promise<StoredInput | null> {
  const dish = findByName(args.recipe, catalog.menuItems);
  if (!dish.ok) return null;
  const said = normalizeText(args.recipe);
  if (catalog.recipes.some((r) => r.menuItemId !== dish.item.id && normalizeText(r.name) === said)) return null;
  const existing = await prisma.recipe.findUnique({
    where: { menuItemId: dish.item.id },
    select: { versions: { where: { status: { in: ["APPROVED", "DRAFT"] } }, select: { status: true, _count: { select: { lines: true } } } } },
  });
  if (existing?.versions.some((v) => v.status === "APPROVED" || v._count.lines > 0)) return null;
  const lines = args.changes.map((c) => {
    if (!c.quantity) throw new OpsError(`${dish.item.name} has no recipe yet, so there is nothing to remove. Ask for the amounts of its ingredients.`);
    return { item: c.item, quantity: c.quantity, unit: c.unit };
  });
  return buildNewRecipe({ dish: dish.item.id, portions: null, lines, note: args.note }, catalog);
}

/** Ingredients and preps a recipe line may name, each with the unit it is measured in. */
async function recipeSources(catalog: Catalog, exceptRecipeId: string | null) {
  const prepRows = await prisma.recipe.findMany({
    where: { kind: "PREP", ...(exceptRecipeId ? { id: { not: exceptRecipeId } } : {}) },
    select: { id: true, versions: { where: { status: { in: ["APPROVED", "DRAFT"] } }, select: { yieldUnit: true }, take: 1 } },
  });
  type Source = Named & { kind: "ingredient" | "prep"; unit: "G" | "ML" | "PCS" };
  return [
    ...catalog.ingredients.map((i): Source => ({ ...i, kind: "ingredient" })),
    ...catalog.recipes
      .filter((r) => r.kind === "PREP" && prepRows.some((p) => p.id === r.id))
      .map((r): Source => ({ ...r, kind: "prep", unit: prepRows.find((p) => p.id === r.id)!.versions[0]?.yieldUnit ?? "G" })),
  ];
}

/** A dish's recipe may be written here only while it has none, or only an empty draft. */
async function openDishRecipe(menuItemId: string, dishName: string) {
  const existing = await prisma.recipe.findUnique({
    where: { menuItemId },
    select: { id: true, versions: { where: { status: { in: ["APPROVED", "DRAFT"] } }, select: { status: true, _count: { select: { lines: true } } } } },
  });
  if (existing?.versions.some((v) => v.status === "APPROVED")) {
    throw new OpsError(`${dishName} already has an approved recipe. To change its amounts, ask for a recipe change instead.`, 409);
  }
  if (existing?.versions.some((v) => v._count.lines > 0)) {
    throw new OpsError(`${dishName} already has a draft recipe with ingredients. Open it on the recipe screen to finish it, or discard it there first.`, 409);
  }
  return existing?.id ?? null;
}

/**
 * A new dish recipe said or typed in one go. Every line must match the
 * ingredient list (or a prep): all the names that don't are returned
 * together, with the closest options, so the person can answer at once.
 */
async function buildNewRecipe(args: Args<"write_recipe">, catalog: Catalog): Promise<StoredInput> {
  const dish = pick("Dish", args.dish, catalog.menuItems);
  const recipeId = await openDishRecipe(dish.id, dish.name);
  const sources = await recipeSources(catalog, recipeId);
  const portions = args.portions ?? 1;
  const unmatched: { said: string; problem: "not_found" | "ambiguous"; options: string[] }[] = [];
  const merged = new Map<string, { source: (typeof sources)[number]; quantity: number; said: string[] }>();
  for (const l of args.lines) {
    const hit = findByName(l.item, sources);
    if (!hit.ok) {
      unmatched.push({ said: l.item, problem: hit.reason, options: (hit.reason === "ambiguous" ? hit.candidates : hit.suggestions).map((c) => c.name) });
      continue;
    }
    const perPortion = amountIn(hit.item, l.quantity, l.unit) / portions;
    const key = `${hit.item.kind}:${hit.item.id}`;
    const row = merged.get(key);
    if (row) {
      row.quantity += perPortion;
      row.said.push(l.item);
    } else merged.set(key, { source: hit.item, quantity: perPortion, said: [l.item] });
  }
  if (unmatched.length) {
    throw new OpsError(
      `These aren't on the ingredient list as said: ${unmatched.map((u) => `"${u.said}"`).join(", ")}. Ask which ingredient each one is, offering the options; if it is new, it must be added on the Stock screen first.`,
      409,
      { unmatched },
    );
  }
  const rows = [...merged.values()];
  return {
    tool: "write_recipe",
    menuItemId: dish.id,
    recipeId,
    portions,
    note: args.note?.trim() || null,
    lines: rows.map((r) => ({
      ingredientId: r.source.kind === "ingredient" ? r.source.id : null,
      subRecipeId: r.source.kind === "prep" ? r.source.id : null,
      quantity: r.quantity,
      wastePct: 0,
      note: null,
    })),
    rows: rows.map((r) => ({ said: r.said.join(", "), item: { name: r.source.name, nameFa: r.source.nameFa }, unit: r.source.unit, quantity: r.quantity })),
  };
}

const invoiceLineSelect = {
  id: true,
  rawName: true,
  quantity: true,
  unit: true,
  unitPriceFils: true,
  ingredientId: true,
  invoice: { select: { id: true, invoiceDate: true, invoiceNo: true, supplier: { select: { name: true } } } },
} as const;

async function buildInvoiceFix(args: Args<"fix_invoice_price">, catalog: Catalog, today: string): Promise<StoredInput> {
  const unitPriceFils = Math.round(args.unitPrice * 100);
  if (args.lineId) {
    const line = await prisma.purchaseLine.findFirst({ where: { id: args.lineId, invoice: { voidedAt: null } }, select: { id: true, invoiceId: true } });
    if (!line) throw new OpsError("That invoice line was not found (or its invoice was undone). Look it up again with recent_purchases.", 404);
    return { tool: "fix_invoice_price", invoiceId: line.invoiceId, lineId: line.id, unitPriceFils };
  }
  if (!args.item) throw new OpsError("Say which item's price to correct.");
  const exactDay = args.day ? day(args.day, today) : null;
  const from = exactDay ? new Date(`${exactDay}T00:00:00+04:00`) : new Date(new Date(`${today}T00:00:00+04:00`).getTime() - 13 * 86_400_000);
  const to = exactDay ? new Date(from.getTime() + 86_400_000) : undefined;
  const supplier = args.supplier ? pick("Supplier", args.supplier, catalog.suppliers) : null;
  const candidates = await prisma.purchaseLine.findMany({
    where: { invoice: { voidedAt: null, invoiceDate: { gte: from, ...(to ? { lt: to } : {}) }, ...(supplier ? { supplierId: supplier.id } : {}) } },
    select: invoiceLineSelect,
    orderBy: { invoice: { invoiceDate: "desc" } },
    take: 300,
  });
  // The item said is a known ingredient, or (part of) the name printed on the line.
  const ingredient = findByName(args.item, catalog.ingredients);
  const lines = candidates.filter((l) =>
    ingredient.ok ? l.ingredientId === ingredient.item.id : findByName(args.item!, [{ id: l.id, name: l.rawName, nameFa: null }]).ok,
  );
  if (lines.length === 0) throw new OpsError(`No saved invoice line for "${args.item}" ${exactDay ? `on ${exactDay}` : "in the last 14 days"}${supplier ? ` from ${supplier.name}` : ""}.`, 404);
  if (lines.length > 1) {
    throw new OpsError("Several invoice lines match. Ask the person which one, then call again with its lineId.", 409, {
      lines: lines.slice(0, 8).map((l) => ({
        lineId: l.id,
        day: new Date(l.invoice.invoiceDate.getTime() + 4 * 3_600_000).toISOString().slice(0, 10),
        supplier: l.invoice.supplier.name,
        invoiceNo: l.invoice.invoiceNo,
        printedName: l.rawName,
        quantity: l.quantity,
        unit: l.unit,
        unitPriceFils: l.unitPriceFils,
      })),
    });
  }
  return { tool: "fix_invoice_price", invoiceId: lines[0].invoice.id, lineId: lines[0].id, unitPriceFils };
}

// ─── Preview ────────────────────────────────────────────────────────────────

export async function preview(input: StoredInput): Promise<{ preview: Preview; sensitive: boolean }> {
  switch (input.tool) {
    case "record_waste":
    case "record_staff_meal":
    case "adjust_stock": {
      const item = await prisma.ingredient.findUnique({ where: { id: input.ingredientId } });
      if (!item) throw new OpsError("That ingredient no longer exists.", 404);
      const [have, prices] = await Promise.all([onHand([item.id]), lastPrices([item.id])]);
      const before = have.get(item.id)!;
      const p: StockPreview = {
        kind: "stock",
        type: input.type,
        item: itemRef({ ...item, aliases: [] }),
        day: input.day,
        quantity: input.quantity,
        before,
        after: before + input.quantity,
        valueFils: valueOf(Math.abs(input.quantity), prices.get(item.id)),
        note: input.note,
      };
      return { preview: p, sensitive: input.tool === "adjust_stock" };
    }
    case "stock_count": {
      const ids = input.counts.map((c) => c.ingredientId);
      const [items, have, prices] = await Promise.all([prisma.ingredient.findMany({ where: { id: { in: ids } } }), onHand(ids), lastPrices(ids)]);
      const rows = input.counts.map((c) => {
        const item = items.find((i) => i.id === c.ingredientId);
        if (!item) throw new OpsError("An ingredient in this count no longer exists.", 404);
        const before = have.get(item.id)!;
        const valueFils = valueOf(c.counted - before, prices.get(item.id));
        return { item: itemRef({ ...item, aliases: [] }), before, after: c.counted, valueFils, big: bigCountDifference(before, c.counted, valueFils) };
      });
      const p: CountPreview = { kind: "count", day: input.day, rows };
      return { preview: p, sensitive: rows.some((r) => r.big) };
    }
    case "change_recipe":
      return { preview: await previewRecipe(input), sensitive: true };
    case "write_recipe": {
      // Checked again on confirm: someone may have written the recipe meanwhile.
      const dish = await prisma.menuItem.findUnique({ where: { id: input.menuItemId }, select: { id: true, name: true, nameFa: true, price: true } });
      if (!dish) throw new OpsError("That dish is no longer on the menu.", 404);
      if ((await openDishRecipe(dish.id, dish.name)) !== input.recipeId) throw new OpsError(`${dish.name} changed since this was suggested. Ask again.`, 409);
      const cost = await previewNewRecipeCost(input.lines);
      const p: NewRecipePreview = {
        kind: "new_recipe",
        dish: { id: dish.id, name: dish.name, nameFa: dish.nameFa },
        portions: input.portions,
        rows: input.rows,
        cost: { perPortionFils: cost.perPortionFils, verified: cost.verified, missingPrices: cost.missing },
        menuPriceFils: Math.round(dish.price * 100),
        foodCostPct: cost.perPortionFils == null ? null : dishMargin(cost.perPortionFils, dish.price).foodCostPct,
        note: input.note,
      };
      // Only a draft: costs, stock and profit don't change until the owner approves it.
      return { preview: p, sensitive: false };
    }
    case "fix_invoice_price":
      return { preview: await previewInvoiceFix(input), sensitive: true };
    case "record_free_food": {
      const priced = await priceFreeFood(input.items);
      const p: FreeFoodPreview = {
        kind: "free_food",
        type: input.kind,
        day: input.day,
        recipient: input.recipient,
        reason: input.reason,
        lines: priced.lines.map((l) => ({ name: l.name, nameFa: l.nameFa, quantity: l.quantity, unitCostFils: l.unitCostFils, menuPriceFils: l.menuPriceFils })),
        costFils: priced.costFils,
        menuValueFils: priced.menuValueFils,
      };
      // Undoable in one tap and no money changes hands: one confirmation is enough.
      return { preview: p, sensitive: false };
    }
  }
}

async function previewRecipe(input: Extract<StoredInput, { tool: "change_recipe" }>): Promise<RecipePreview> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: input.recipeId },
    include: { menuItem: { select: { price: true, nameFa: true } }, versions: { where: { status: { in: ["APPROVED", "DRAFT"] } }, select: { id: true, status: true, number: true, yieldUnit: true } } },
  });
  if (!recipe) throw new OpsError("Recipe not found.", 404);
  const approved = recipe.versions.find((v) => v.status === "APPROVED");
  if (approved?.id !== input.fromVersionId || recipe.versions.some((v) => v.status === "DRAFT")) {
    throw new OpsError(`${recipe.name} was changed since this was suggested. Ask again for a fresh preview.`, 409);
  }
  const cost = await previewRecipeCost(recipe.id, input.lines);
  const price = recipe.kind === "DISH" && recipe.menuItem ? recipe.menuItem.price : null;
  return {
    kind: "recipe",
    recipe: { id: recipe.id, name: recipe.name, nameFa: recipe.nameFa ?? recipe.menuItem?.nameFa ?? null, kind: recipe.kind, yieldUnit: approved.yieldUnit },
    fromVersion: approved.number,
    approve: input.approve,
    changes: input.changes,
    cost: { beforeFils: cost.before ? cost.before.perUnitFils : null, afterFils: cost.after.perUnitFils, verified: cost.after.verified },
    menuPriceFils: price == null ? null : Math.round(price * 100),
    foodCostPct: {
      before: price != null && cost.before ? dishMargin(cost.before.perUnitFils, price).foodCostPct : null,
      after: price != null ? dishMargin(cost.after.perUnitFils, price).foodCostPct : null,
    },
    note: input.note,
  };
}

async function loadInvoice(invoiceId: string) {
  const inv = await prisma.purchaseInvoice.findUnique({
    where: { id: invoiceId },
    include: { supplier: true, lines: { include: { ingredient: { select: { id: true, name: true, nameFa: true, unit: true } } } } },
  });
  if (!inv) throw new OpsError("Invoice not found.", 404);
  if (inv.voidedAt) throw new OpsError("That invoice was undone or is being edited.", 409);
  return inv;
}

const dubaiDay = (d: Date) => new Date(d.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);

async function previewInvoiceFix(input: Extract<StoredInput, { tool: "fix_invoice_price" }>): Promise<InvoicePreview> {
  const inv = await loadInvoice(input.invoiceId);
  if (!inv.documentId) throw new OpsError("This invoice has no photo to edit from; correct it on the invoice screen.", 409);
  if (inv.paymentMode === "credit" && inv.paidAt) throw new OpsError("This credit invoice is already paid; correct it on the invoice screen so the payment is checked too.", 409);
  const fixed = fixUnitPrice(inv, input.lineId, input.unitPriceFils);
  if (!fixed.ok) {
    throw new OpsError(
      {
        no_line: "That line is no longer on the invoice.",
        no_unit_price: "That line has no unit price printed; correct it on the invoice screen.",
        same_price: "That is already the price on the invoice.",
        negative: "That price would make the line negative.",
      }[fixed.error],
      409,
    );
  }
  const line = inv.lines.find((l) => l.id === input.lineId)!;
  return {
    kind: "invoice",
    invoice: { id: inv.id, supplier: inv.supplier.name, invoiceNo: inv.invoiceNo, day: dubaiDay(inv.invoiceDate) },
    line: { rawName: line.rawName, quantity: line.quantity, unit: line.unit, item: line.ingredient ? { name: line.ingredient.name, nameFa: line.ingredient.nameFa } : null },
    unitPrice: { beforeFils: line.unitPriceFils, afterFils: input.unitPriceFils },
    lineTotal: { beforeFils: line.lineTotalFils, afterFils: fixed.line.lineTotalFils },
    total: { beforeFils: inv.totalFils, afterFils: fixed.invoice.totalFils },
  };
}

// ─── Apply and undo ─────────────────────────────────────────────────────────

export type ApplyResult =
  | { movementIds: string[] }
  | { recipeId: string; versionId: string; previousVersionId: string | null; approved: boolean; created?: boolean }
  | { invoiceId: string; previousInvoiceId: string; documentId: string; restore: SaveInvoiceInput }
  | { freeFoodId: string };

const SPOKEN = { G: "g", ML: "ml", PCS: "pcs" } as const;
const aed = (fils: number | null) => (fils == null ? null : fils / 100);

/** The saved invoice in the shape the review screen saves (so it can be saved again changed). */
function invoiceInput(inv: Awaited<ReturnType<typeof loadInvoice>>): SaveInvoiceInput {
  return {
    supplier: { id: inv.supplierId, name: inv.supplier.name, trn: inv.supplier.trn, phone: inv.supplier.phone },
    invoiceNo: inv.invoiceNo,
    invoiceDate: dubaiDay(inv.invoiceDate),
    paymentMode: (inv.paymentMode as SaveInvoiceInput["paymentMode"]) ?? null,
    dueDate: inv.dueDate ? dubaiDay(inv.dueDate) : null,
    paidBy: inv.paidBy,
    notes: inv.notes,
    pricesIncludeVat: inv.pricesIncludeVat,
    subtotal: aed(inv.subtotalFils),
    discount: inv.discountFils / 100,
    vat: aed(inv.vatFils),
    total: inv.totalFils / 100,
    lines: inv.lines.map((l) => ({
      rawName: l.rawName,
      itemCode: l.itemCode,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: aed(l.unitPriceFils),
      discount: l.discountFils / 100,
      vat: aed(l.vatFils),
      lineTotal: l.lineTotalFils / 100,
      category: l.category.toLowerCase() as SaveInvoiceInput["lines"][number]["category"],
      ingredient: l.ingredient ? { id: l.ingredient.id, name: l.ingredient.name, unit: SPOKEN[l.ingredient.unit] } : null,
      stockQuantity: l.baseQty,
    })),
  };
}

/** Puts a saved invoice back through edit → save with new values; the old one stays as voided history. */
async function resaveInvoice(invoiceId: string, change: (input: SaveInvoiceInput, inv: Awaited<ReturnType<typeof loadInvoice>>) => SaveInvoiceInput, actor: Actor, via: string) {
  const inv = await loadInvoice(invoiceId);
  if (!inv.documentId) throw new OpsError("This invoice has no photo to edit from; correct it on the invoice screen.", 409);
  const before = invoiceInput(inv);
  const after = change(before, inv);
  const { documentId } = await editInvoice(invoiceId, actor, via);
  try {
    const saved = await saveDocument(documentId, after, actor, via);
    return { invoiceId: saved.invoiceId, documentId, before };
  } catch (e) {
    // Couldn't save the corrected version: put the original back as it was.
    await saveDocument(documentId, before, actor, via);
    throw e;
  }
}

export async function apply(input: StoredInput, actor: Actor, via: string, sourceDocumentId: string | null): Promise<ApplyResult> {
  switch (input.tool) {
    case "record_waste":
    case "record_staff_meal":
    case "adjust_stock": {
      const m = await addMovement(input.ingredientId, { type: input.type, quantity: input.quantity, day: input.day, note: input.note }, actor, via);
      return { movementIds: [m.id] };
    }
    case "stock_count": {
      const r = await recordCount(input.counts, input.day, actor, via);
      return { movementIds: r.movementIds };
    }
    case "change_recipe": {
      if (input.approve && actor.role !== "ADMIN") throw new OpsError("Only the owner can approve a recipe.", 403);
      return prisma.$transaction(async (tx) => {
        const version = await tx.recipeVersion.findUnique({ where: { id: input.fromVersionId }, select: { yieldQuantity: true, yieldUnit: true, method: true } });
        if (!version) throw new OpsError("Recipe not found.", 404);
        const draft = await writeDraft(tx, input.recipeId, { yieldQuantity: version.yieldQuantity, yieldUnit: version.yieldUnit, note: input.note, lines: input.lines }, actor, {
          documentId: sourceDocumentId,
          via,
        });
        if (!input.approve) return { recipeId: input.recipeId, versionId: draft.versionId, previousVersionId: input.fromVersionId, approved: false };
        const done = await approveDraftTx(tx, input.recipeId, actor, via);
        return { recipeId: input.recipeId, versionId: done.versionId, previousVersionId: done.previousVersionId, approved: true };
      });
    }
    case "write_recipe":
      return prisma.$transaction(async (tx) => {
        let recipeId = input.recipeId;
        const created = !recipeId;
        if (!recipeId) {
          const dish = await tx.menuItem.findUniqueOrThrow({ where: { id: input.menuItemId }, select: { name: true, nameFa: true } });
          const clash = await tx.recipe.findFirst({ where: { name: { equals: dish.name, mode: "insensitive" } }, select: { menuItemId: true } });
          if (clash) throw new OpsError(`A recipe called "${dish.name}" already exists. Ask again.`, 409);
          const recipe = await tx.recipe.create({ data: { kind: "DISH", name: dish.name, nameFa: dish.nameFa, menuItemId: input.menuItemId } });
          await tx.auditLog.create({
            data: { actor: actor.email, action: "recipe.create", entity: "Recipe", entityId: recipe.id, via, after: { kind: "DISH", name: dish.name, menuItemId: input.menuItemId } },
          });
          recipeId = recipe.id;
        }
        const draft = await writeDraft(
          tx,
          recipeId,
          { yieldQuantity: 1, yieldUnit: "PCS", note: input.note ?? (input.portions > 1 ? `Said for ${input.portions} portions` : null), lines: input.lines },
          actor,
          { documentId: sourceDocumentId, via },
        );
        return { recipeId, versionId: draft.versionId, previousVersionId: null, approved: false, created };
      });
    case "fix_invoice_price": {
      const r = await resaveInvoice(
        input.invoiceId,
        (before, inv) => {
          const fixed = fixUnitPrice(inv, input.lineId, input.unitPriceFils);
          if (!fixed.ok) throw new OpsError("The invoice changed since this was suggested. Ask again.", 409);
          const at = inv.lines.findIndex((l) => l.id === input.lineId);
          return {
            ...before,
            subtotal: aed(fixed.invoice.subtotalFils),
            vat: aed(fixed.invoice.vatFils),
            total: fixed.invoice.totalFils / 100,
            lines: before.lines.map((l, i) =>
              i === at ? { ...l, unitPrice: fixed.line.unitPriceFils / 100, lineTotal: fixed.line.lineTotalFils / 100, vat: aed(fixed.line.vatFils) } : l,
            ),
          };
        },
        actor,
        via,
      );
      return { invoiceId: r.invoiceId, previousInvoiceId: input.invoiceId, documentId: r.documentId, restore: r.before };
    }
    case "record_free_food": {
      const r = await recordFreeFood(
        { kind: input.kind, day: input.day, items: input.items, recipient: input.recipient, reason: input.reason },
        actor,
        { via, sourceDocumentId },
      );
      return { freeFoodId: r.id };
    }
  }
}

async function saveEmptyDraft(recipeId: string, actor: Actor, via: string) {
  await prisma.$transaction((tx) => writeDraft(tx, recipeId, { yieldQuantity: 1, yieldUnit: "PCS", note: null, lines: [] }, actor, { documentId: null, via }));
}

/** Takes an applied change back. Nothing is deleted: the ledger gets opposite entries, recipes a new version. */
export async function undo(tool: WriteTool, result: ApplyResult, actor: Actor, via: string) {
  if ("movementIds" in result) {
    await prisma.$transaction(async (tx) => {
      const moves = await tx.stockMovement.findMany({ where: { id: { in: result.movementIds } }, include: { reversedBy: { select: { id: true } } } });
      for (const m of moves) {
        if (m.reversedBy) continue;
        await tx.stockMovement.create({
          data: { ingredientId: m.ingredientId, type: "ADJUSTMENT", quantity: -m.quantity, at: new Date(), reversesId: m.id, note: `Undo ${m.type.toLowerCase().replace("_", " ")}`, createdById: actor.id },
        });
      }
      await tx.auditLog.create({
        data: { actor: actor.email, action: "stock.undo", entity: "StockMovement", entityId: result.movementIds[0] ?? "-", via, before: { movementIds: result.movementIds, tool } },
      });
    });
    return;
  }
  if ("recipeId" in result) {
    const versions = await prisma.recipeVersion.findMany({ where: { recipeId: result.recipeId, status: { in: ["APPROVED", "DRAFT"] } }, select: { id: true, status: true } });
    if (!result.approved) {
      if (!versions.some((v) => v.id === result.versionId && v.status === "DRAFT")) throw new OpsError("That draft was already approved or discarded.", 409);
      // A recipe written here from nothing goes away; an empty one it filled is emptied again.
      if (tool === "write_recipe") {
        if (result.created) await deleteRecipe(result.recipeId, actor, via);
        else await saveEmptyDraft(result.recipeId, actor, via);
        return;
      }
      await discardDraft(result.recipeId, actor, via);
      return;
    }
    if (actor.role !== "ADMIN") throw new OpsError("Only the owner can change an approved recipe.", 403);
    if (!versions.some((v) => v.id === result.versionId && v.status === "APPROVED")) throw new OpsError("The recipe changed again since; undo isn't safe. Change it on the recipe screen.", 409);
    if (versions.some((v) => v.status === "DRAFT")) throw new OpsError("The recipe has a draft open; discard it first.", 409);
    if (!result.previousVersionId) throw new OpsError("There was no earlier version to go back to.", 409);
    await prisma.$transaction(async (tx) => {
      const prev = await tx.recipeVersion.findUniqueOrThrow({ where: { id: result.previousVersionId! }, include: { lines: { orderBy: { order: "asc" } } } });
      await writeDraft(
        tx,
        result.recipeId,
        {
          yieldQuantity: prev.yieldQuantity,
          yieldUnit: prev.yieldUnit,
          note: `Back to version ${prev.number} (undo)`,
          method: prev.method,
          lines: prev.lines.map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: l.quantity, wastePct: l.wastePct, note: l.note })),
        },
        actor,
        { documentId: prev.sourceDocumentId, via },
      );
      await approveDraftTx(tx, result.recipeId, actor, via);
    });
    return;
  }
  if ("freeFoodId" in result) {
    await voidFreeFood(result.freeFoodId, actor, via);
    return;
  }
  await resaveInvoice(result.invoiceId, () => result.restore, actor, via);
}
