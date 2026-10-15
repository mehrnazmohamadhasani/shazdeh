import { VAT_RATE, type CostIssue, type VersionCost } from "./recipe-cost";

/*
 * Estimated profit for a set of sales (Today screen). Always an estimate:
 * food cost is what the approved recipes say a dish should use, not what
 * was used. Nothing unknown is counted as zero — an order is in the
 * estimate only when every dish on it has a cost from an approved recipe
 * and its platform fees are known (a fee rule exists). Everything else is
 * reported as "not covered", with the reason, so the screen can say
 * "covers AED X of AED Y" instead of a figure that looks complete.
 *
 * Sales are food sales (menu prices, VAT included, after discounts);
 * profit is worked out on the price without VAT, like dish margins.
 */

export type DishCost =
  | { ok: true; perPortionFils: number }
  | { ok: false; reason: "no_recipe" | "not_approved" | "prep_not_approved" | "no_price" };

export type ProfitSale = {
  channel: string;
  /** Food sales with VAT, after discounts. */
  foodSalesFils: number;
  items: { menuItemId: string | null; name: string; quantity: number }[];
  /** Platform fees in fils as food cost counts them (with or without VAT); null: unknown. */
  feesFils: number | null;
};

export type ProfitGap =
  | { kind: "fees_unknown"; channel: string; orders: number; salesFils: number }
  | { kind: "dish"; name: string; reason: Exclude<DishCost, { ok: true }>["reason"] | "not_matched"; quantity: number }
  | { kind: "no_dishes"; channel: string; orders: number };

export type ProfitEstimate = {
  /** All food sales, with VAT. */
  salesFils: number;
  orders: number;
  /** The part of the sales the estimate covers. */
  covered: { orders: number; salesFils: number; salesExVatFils: number; foodCostFils: number; feesFils: number; profitFils: number };
  gaps: ProfitGap[];
};

export const exVat = (fils: number) => Math.round(fils / (1 + VAT_RATE));

/** What one portion of a dish costs from its approved version — or why it can't be known. */
export function dishCostFrom(approved: VersionCost | null): DishCost {
  if (!approved) return { ok: false, reason: "not_approved" };
  const blocking = (k: CostIssue["kind"]) => approved.issues.some((i) => i.kind === k);
  if (blocking("no_lines")) return { ok: false, reason: "not_approved" };
  if (blocking("draft_prep") || blocking("empty_prep") || blocking("cycle")) return { ok: false, reason: "prep_not_approved" };
  if (blocking("no_price")) return { ok: false, reason: "no_price" };
  return { ok: true, perPortionFils: approved.perUnitFils };
}

export function estimateProfit(sales: ProfitSale[], costs: Map<string, DishCost>): ProfitEstimate {
  const covered = { orders: 0, salesFils: 0, salesExVatFils: 0, foodCostFils: 0, feesFils: 0, profitFils: 0 };
  const fees = new Map<string, { orders: number; salesFils: number }>();
  const empty = new Map<string, number>();
  const dishes = new Map<string, Extract<ProfitGap, { kind: "dish" }>>();

  for (const sale of sales) {
    let cost = 0;
    let known = sale.items.length > 0;
    if (!sale.items.length) empty.set(sale.channel, (empty.get(sale.channel) ?? 0) + 1);
    for (const item of sale.items) {
      const c = item.menuItemId ? costs.get(item.menuItemId) ?? { ok: false as const, reason: "no_recipe" as const } : null;
      if (c?.ok) {
        cost += c.perPortionFils * item.quantity;
        continue;
      }
      known = false;
      const reason = c ? c.reason : "not_matched";
      const key = `${reason}|${item.name}`;
      const gap = dishes.get(key) ?? { kind: "dish" as const, name: item.name, reason, quantity: 0 };
      gap.quantity += item.quantity;
      dishes.set(key, gap);
    }
    if (sale.feesFils == null) {
      known = false;
      const f = fees.get(sale.channel) ?? { orders: 0, salesFils: 0 };
      f.orders++;
      f.salesFils += sale.foodSalesFils;
      fees.set(sale.channel, f);
    }
    if (!known) continue;
    const net = exVat(sale.foodSalesFils);
    covered.orders++;
    covered.salesFils += sale.foodSalesFils;
    covered.salesExVatFils += net;
    covered.foodCostFils += cost;
    covered.feesFils += sale.feesFils!;
  }
  covered.foodCostFils = Math.round(covered.foodCostFils);
  covered.profitFils = covered.salesExVatFils - covered.foodCostFils - covered.feesFils;

  return {
    salesFils: sales.reduce((s, x) => s + x.foodSalesFils, 0),
    orders: sales.length,
    covered,
    gaps: [
      ...[...fees].map(([channel, f]): ProfitGap => ({ kind: "fees_unknown", channel, ...f })),
      ...[...empty].map(([channel, orders]): ProfitGap => ({ kind: "no_dishes", channel, orders })),
      ...[...dishes.values()].sort((a, b) => b.quantity - a.quantity),
    ],
  };
}

export type LowStockRow = { id: string; name: string; nameFa: string | null; unit: "G" | "ML" | "PCS"; onHand: number; lowStockAt: number | null };

/** Ingredients below zero (a count is needed) first, then those at or below their warning level. */
export function lowStock(rows: LowStockRow[]) {
  const negative = rows.filter((r) => r.onHand < 0).sort((a, b) => a.onHand - b.onHand);
  const low = rows
    .filter((r) => r.onHand >= 0 && r.lowStockAt != null && r.onHand <= r.lowStockAt)
    .sort((a, b) => a.onHand / (a.lowStockAt || 1) - b.onHand / (b.lowStockAt || 1));
  return { negative, low };
}

/** Credit invoices: overdue, or due within `soonDays`. */
export function creditDue(invoices: { totalFils: number; dueDate: Date | null }[], now: Date, soonDays = 3) {
  const soon = new Date(now.getTime() + soonDays * 86_400_000);
  const out = { overdue: { count: 0, fils: 0 }, soon: { count: 0, fils: 0 } };
  for (const inv of invoices) {
    if (!inv.dueDate) continue;
    const bucket = inv.dueDate < now ? out.overdue : inv.dueDate <= soon ? out.soon : null;
    if (!bucket) continue;
    bucket.count++;
    bucket.fils += inv.totalFils;
  }
  return out;
}

/** "near" from 80 % of the monthly limit, "reached" at the limit (reading stops). */
export function aiLevel(spentUsd: number, capUsd: number): "ok" | "near" | "reached" {
  if (spentUsd >= capUsd) return "reached";
  return spentUsd >= capUsd * 0.8 ? "near" : "ok";
}
