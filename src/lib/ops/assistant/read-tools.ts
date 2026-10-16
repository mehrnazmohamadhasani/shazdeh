import "server-only";
import { prisma } from "@/lib/prisma";
import { formatAmount } from "../units";
import { getRecipe } from "../recipes";
import { todaySummary } from "../today";
import { salesOverview } from "../sales";
import { listPayables } from "../catalog";
import { lastPrices, onHand, pick, type Catalog } from "./catalog";
import { checkDay } from "./match";
import { pricePerBigUnit } from "./model-format";
import type { toolArgs } from "./definitions";
import type { z } from "zod";

/*
 * The assistant's read-only tools. They answer with plain JSON for the
 * model to put into words: amounts in g / ml / pcs with a readable form,
 * money in fils (integers), null where a figure is not known.
 */

type Args<K extends keyof typeof toolArgs> = z.infer<(typeof toolArgs)[K]>;
const BASE = { G: "g", ML: "ml", PCS: "pcs" } as const;
const dubaiDay = (d: Date) => new Date(d.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);

export async function stockLevel(args: Args<"stock_level">, catalog: Catalog) {
  if (args.item) {
    const item = pick("Ingredient", args.item, catalog.ingredients);
    const [have, prices] = await Promise.all([onHand([item.id]), lastPrices([item.id])]);
    const amount = have.get(item.id)!;
    const price = prices.get(item.id);
    return {
      item: { name: item.name, nameFa: item.nameFa },
      onHand: amount,
      unit: BASE[item.unit],
      readable: formatAmount(amount, BASE[item.unit]),
      lowStockAt: item.lowStockAt,
      isLow: item.lowStockAt != null && amount <= item.lowStockAt,
      // The latest priced purchase, or the valued opening stock when nothing was bought since.
      lastPrice: price ? { day: dubaiDay(price.at), from: price.supplier ?? "opening stock", ...pricePerBigUnit(price.filsPerUnit, item.unit) } : null,
    };
  }
  const have = await onHand(catalog.ingredients.map((i) => i.id));
  const low = catalog.ingredients
    .filter((i) => i.lowStockAt != null && have.get(i.id)! <= i.lowStockAt)
    .map((i) => ({ name: i.name, nameFa: i.nameFa, onHand: formatAmount(have.get(i.id)!, BASE[i.unit]), lowStockAt: formatAmount(i.lowStockAt!, BASE[i.unit]) }));
  const out = catalog.ingredients.filter((i) => have.get(i.id)! <= 0 && i.lowStockAt == null).map((i) => ({ name: i.name, nameFa: i.nameFa }));
  return { low, outWithoutWarningLevel: out.slice(0, 30), ingredients: catalog.ingredients.length };
}

export async function recentPurchases(args: Args<"recent_purchases">, catalog: Catalog, today: string) {
  const days = args.days ?? 14;
  const since = new Date(new Date(`${today}T00:00:00+04:00`).getTime() - (days - 1) * 86_400_000);
  const ingredient = args.item ? pick("Ingredient", args.item, catalog.ingredients) : null;
  const supplier = args.supplier ? pick("Supplier", args.supplier, catalog.suppliers) : null;
  const lines = await prisma.purchaseLine.findMany({
    where: {
      invoice: { voidedAt: null, invoiceDate: { gte: since }, ...(supplier ? { supplierId: supplier.id } : {}) },
      ...(ingredient ? { ingredientId: ingredient.id } : {}),
    },
    orderBy: { invoice: { invoiceDate: "desc" } },
    take: 25,
    select: {
      id: true,
      rawName: true,
      quantity: true,
      unit: true,
      unitPriceFils: true,
      lineTotalFils: true,
      ingredient: { select: { name: true, nameFa: true } },
      invoice: { select: { id: true, invoiceNo: true, invoiceDate: true, paymentMode: true, paidAt: true, supplier: { select: { name: true } } } },
    },
  });
  return {
    days,
    lines: lines.map((l) => ({
      lineId: l.id,
      day: dubaiDay(l.invoice.invoiceDate),
      supplier: l.invoice.supplier.name,
      invoiceNo: l.invoice.invoiceNo,
      printedName: l.rawName,
      ingredient: l.ingredient,
      quantity: l.quantity,
      unit: l.unit,
      unitPriceFils: l.unitPriceFils,
      lineTotalFils: l.lineTotalFils,
    })),
  };
}

export async function recipeInfo(args: Args<"recipe_info">, catalog: Catalog) {
  const entry = pick("Recipe", args.recipe, catalog.recipes);
  const data = await getRecipe(entry.id);
  if (!data) return { error: "not_found" };
  const shown = data.approved ?? data.draft;
  if (!shown) return { recipe: entry.name, error: "no_version" };
  return {
    recipe: { name: entry.name, nameFa: entry.nameFa, kind: entry.kind },
    status: data.approved ? `approved v${data.approved.version.number}` : "draft only (not approved)",
    hasDraft: !!data.draft,
    per: entry.kind === "DISH" ? "portion" : `batch of ${shown.version.yieldQuantity} ${BASE[shown.version.yieldUnit]}`,
    lines: shown.version.lines.map((l, i) => ({
      name: l.ingredient?.name ?? l.subRecipe?.name ?? "?",
      nameFa: l.ingredient?.nameFa ?? l.subRecipe?.nameFa ?? null,
      quantity: l.quantity,
      unit: l.ingredient ? BASE[l.ingredient.unit] : "(prep yield unit)",
      wastePct: l.wastePct,
      costFils: shown.cost.lines[i]?.costFils ?? null,
    })),
    ...(entry.kind === "DISH"
      ? { costPerPortionFils: shown.cost.perUnitFils }
      : { costPerBatchFils: shown.cost.totalFils, cost: pricePerBigUnit(shown.cost.perUnitFils, shown.version.yieldUnit) }),
    costVerified: shown.cost.verified,
    costIssues: shown.cost.issues,
    menuPriceAed: entry.menuPriceAed,
    foodCostPct: shown.cost.margin?.foodCostPct ?? null,
    marginFils: shown.cost.margin?.marginFils ?? null,
  };
}

export async function dayInfo(args: Args<"today_summary">, todayDay: string) {
  const d = checkDay(args.day, todayDay);
  if (!d.ok) return { error: d.error };
  const s = await todaySummary(d.day);
  return {
    day: s.day,
    salesByChannel: s.byChannel.map((c) => ({ channel: c.name, orders: c.orders, foodSalesFils: c.foodSalesFils, hasFeeRule: c.hasFeeRule })),
    profitEstimate: s.profit,
    foodCostIncludesVat: s.foodCostIncludesVat,
    alerts: {
      ordersWaiting: s.alerts.ordersWaiting,
      invoicesToCheck: s.alerts.invoicesToCheck,
      receiptsToCheck: s.alerts.receiptsToCheck,
      creditDue: s.alerts.credit,
      lowStock: s.alerts.stock,
    },
  };
}

export async function sales(args: Args<"sales_summary">) {
  const s = await salesOverview(args.month);
  return {
    month: s.month,
    byChannel: s.byChannel.map((c) => ({ channel: c.name, orders: c.orders, foodSalesFils: c.foodSalesFils, feesFils: c.feesFils, feesKnownFor: c.feesKnownFor })),
    receiptsWaiting: s.pending.length,
  };
}

export async function payables() {
  const { open } = await listPayables();
  return {
    open: open.map((i) => ({
      supplier: i.supplier.name,
      invoiceNo: i.invoiceNo,
      day: dubaiDay(i.invoiceDate),
      totalFils: i.totalFils,
      due: i.dueDate ? dubaiDay(i.dueDate) : null,
    })),
    totalFils: open.reduce((s, i) => s + i.totalFils, 0),
  };
}
