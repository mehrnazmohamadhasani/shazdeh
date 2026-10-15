import "server-only";
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES } from "@/lib/ordering/admin";
import { aiSpendThisMonth } from "./ai-usage";
import { estimateFees } from "./platform";
import { aiLevel, creditDue, estimateProfit, lowStock, type ProfitSale } from "./profit";
import { approvedDishCosts } from "./recipes";
import { ruleOn } from "./sales";
import { getOpsSettings } from "./settings";

/*
 * Everything the Today screen shows for one Dubai business day: food
 * sales by channel (never the customer's delivery or service fees), an
 * estimated profit that says how much of the sales it covers, and what
 * needs someone's attention now.
 */

/** Website orders that count as sales (paid or being made / delivered) — as in sales.ts. */
const COUNTED = ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
const DAY_MS = 86_400_000;
const WAITING = ["NEEDS_REVIEW", "FAILED"] as const;

/** Today in Dubai as "2026-10-15". */
export function dubaiToday(now = new Date()) {
  return new Date(now.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);
}

/** A valid "YYYY-MM-DD" not after today, else today. */
export function pickDay(asked: string | null | undefined, now = new Date()) {
  const today = dubaiToday(now);
  if (!asked || !/^\d{4}-\d{2}-\d{2}$/.test(asked) || Number.isNaN(Date.parse(asked))) return today;
  return asked > today ? today : asked;
}

/** The day before / after "YYYY-MM-DD". */
export function shiftDay(day: string, by: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10);
}

export async function todaySummary(day: string, now = new Date()) {
  const start = new Date(`${day}T00:00:00+04:00`);
  const end = new Date(start.getTime() + DAY_MS);
  const [settings, channels, rules, websiteOrders, platformOrders, costs] = await Promise.all([
    getOpsSettings(),
    prisma.channel.findMany({ orderBy: { order: "asc" } }),
    prisma.channelFeeRule.findMany(),
    prisma.order.findMany({
      where: { placedAt: { gte: start, lt: end }, status: { in: [...COUNTED] } },
      select: { subtotalFils: true, discountFils: true, items: { select: { menuItemId: true, name: true, quantity: true } } },
    }),
    prisma.platformOrder.findMany({
      where: { businessDate: new Date(`${day}T00:00:00Z`) },
      select: { channelId: true, businessDate: true, foodSalesFils: true, items: { select: { menuItemId: true, rawName: true, quantity: true } } },
    }),
    // Prices as they were at the end of that day (now, for today).
    approvedDishCosts(end < now ? end : now),
  ]);

  const direct = channels.find((c) => c.kind === "DIRECT");
  const sales: ProfitSale[] = [
    ...websiteOrders.map((o) => ({
      channel: direct?.code ?? "direct",
      foodSalesFils: o.subtotalFils - o.discountFils,
      items: o.items,
      feesFils: 0,
    })),
    ...platformOrders.map((o) => {
      const fees = estimateFees(ruleOn(rules, o.channelId, o.businessDate), o.foodSalesFils);
      return {
        channel: channels.find((c) => c.id === o.channelId)?.code ?? "?",
        foodSalesFils: o.foodSalesFils,
        items: o.items.map((i) => ({ menuItemId: i.menuItemId, name: i.rawName, quantity: i.quantity })),
        // Fee VAT follows the food-cost choice: reclaimed (left out) or a cost.
        feesFils: fees ? (settings.foodCostIncludesVat ? fees.totalFils : fees.totalFils - fees.vatFils) : null,
      };
    }),
  ];

  const byChannel = channels
    .map((c) => {
      const mine = sales.filter((s) => s.channel === c.code);
      return {
        code: c.code,
        name: c.name,
        kind: c.kind,
        orders: mine.length,
        foodSalesFils: mine.reduce((s, x) => s + x.foodSalesFils, 0),
        hasFeeRule: c.kind === "DIRECT" || rules.some((r) => r.channelId === c.id),
        isActive: c.isActive,
      };
    })
    // An inactive platform shows only if it still had sales that day.
    .filter((c) => c.isActive || c.orders > 0);

  return {
    day,
    isToday: day === dubaiToday(now),
    byChannel,
    profit: estimateProfit(sales, costs),
    foodCostIncludesVat: settings.foodCostIncludesVat,
    alerts: await alerts(now),
  };
}

/** What needs someone now (always as of this moment, whichever day is shown). */
async function alerts(now: Date) {
  const [settings, ai, ordersWaiting, ordersActive, receipts, invoices, recipePhotos, credit, ingredients, sums] = await Promise.all([
    getOpsSettings(),
    aiSpendThisMonth(now),
    prisma.order.count({ where: { status: "RECEIVED" } }),
    prisma.order.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.opsDocument.count({ where: { kind: "platform_order", status: { in: [...WAITING] } } }),
    prisma.opsDocument.count({ where: { kind: "supplier_invoice", status: { in: [...WAITING] } } }),
    prisma.opsDocument.count({ where: { kind: "recipe", status: { in: [...WAITING] } } }),
    prisma.purchaseInvoice.findMany({
      where: { voidedAt: null, paidAt: null, paymentMode: "credit", dueDate: { lte: new Date(now.getTime() + 3 * DAY_MS) } },
      select: { totalFils: true, dueDate: true },
    }),
    prisma.ingredient.findMany({ select: { id: true, name: true, nameFa: true, unit: true, lowStockAt: true } }),
    prisma.stockMovement.groupBy({ by: ["ingredientId"], _sum: { quantity: true } }),
  ]);
  const onHand = new Map(sums.map((s) => [s.ingredientId, s._sum.quantity ?? 0]));
  // Only ingredients that have ever moved: one never stocked isn't "out".
  const stock = lowStock(ingredients.filter((i) => onHand.has(i.id)).map((i) => ({ ...i, onHand: onHand.get(i.id)! })));
  return {
    ordersWaiting,
    ordersActive,
    receiptsToCheck: receipts,
    invoicesToCheck: invoices,
    recipePhotosToCheck: recipePhotos,
    credit: creditDue(credit, now),
    ai: { spentUsd: ai.usd, capUsd: settings.aiMonthlyCapUsd, level: aiLevel(ai.usd, settings.aiMonthlyCapUsd) },
    stock,
  };
}

export type TodaySummary = Awaited<ReturnType<typeof todaySummary>>;
