import { z } from "zod";

/*
 * Free food: dishes (and stock items as they are: bread, drinks) that
 * leave the kitchen without a sale. Shared by the
 * server, the screen and the assistant (no server imports here).
 *
 *   STAFF_MEAL    the team ate it — a staff cost
 *   GIFT          given away (photographer, neighbours, workers) — goodwill / marketing
 *   TASTING       tried by the owner or a guest to check or show a dish
 *   COMPENSATION  given to make up for a complaint
 */

export const FREE_FOOD_KINDS = ["STAFF_MEAL", "GIFT", "TASTING", "COMPENSATION"] as const;
export type FreeFoodKind = (typeof FREE_FOOD_KINDS)[number];

export const FREE_FOOD_LABEL: Record<FreeFoodKind, string> = {
  STAFF_MEAL: "Staff meal",
  GIFT: "Gift",
  TASTING: "Tasting",
  COMPENSATION: "Compensation",
};

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const freeFoodItemsSchema = z.array(z.object({ menuItemId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(50) })).max(30);
/** Stock items by amount in their unit (g / ml / pcs). */
export const freeFoodStockSchema = z
  .array(z.object({ ingredientId: z.string().min(1).max(40), amount: z.number().finite().positive().max(1_000_000) }))
  .max(30)
  .default([]);

export const freeFoodSchema = z
  .object({
    kind: z.enum(FREE_FOOD_KINDS),
    /** Dubai day; null = today. */
    day: day.nullable().default(null),
    items: freeFoodItemsSchema.default([]),
    stock: freeFoodStockSchema,
    recipient: z.string().trim().max(80).nullable().default(null),
    reason: z.string().trim().max(200).nullable().default(null),
  })
  .refine((v) => v.items.length + v.stock.length > 0, { message: "Add at least one dish.", path: ["items"] });
export type FreeFoodInput = z.infer<typeof freeFoodSchema>;

/**
 * Food cost of the dishes plus the stock items; unknown (null) as soon as
 * one has no cost — never counted as zero. Menu value and portions are
 * the dishes only.
 */
export function freeFoodTotals(
  lines: { quantity: number; unitCostFils: number | null; menuPriceFils: number }[],
  stock: { costFils: number | null }[] = [],
) {
  const costKnown = lines.every((l) => l.unitCostFils != null) && stock.every((s) => s.costFils != null);
  return {
    costFils: costKnown ? lines.reduce((s, l) => s + l.quantity * l.unitCostFils!, 0) + stock.reduce((s, x) => s + x.costFils!, 0) : null,
    menuValueFils: lines.reduce((s, l) => s + l.quantity * l.menuPriceFils, 0),
    portions: lines.reduce((s, l) => s + l.quantity, 0),
  };
}

/** Portions on a saved record: its dishes; stock items aren't portions. */
export const portionsOf = (items: { quantity: number; ingredientId: string | null }[]) => items.reduce((s, i) => s + (i.ingredientId ? 0 : i.quantity), 0);

/** Free food of a day or month, by kind: portions, cost (null if any unknown) and menu value. */
export function summariseFreeFood(rows: { kind: FreeFoodKind; costFils: number | null; menuValueFils: number; portions: number }[]) {
  const byKind = FREE_FOOD_KINDS.map((kind) => {
    const mine = rows.filter((r) => r.kind === kind);
    return {
      kind,
      records: mine.length,
      portions: mine.reduce((s, r) => s + r.portions, 0),
      costFils: mine.some((r) => r.costFils == null) ? null : mine.reduce((s, r) => s + r.costFils!, 0),
      menuValueFils: mine.reduce((s, r) => s + r.menuValueFils, 0),
    };
  }).filter((k) => k.records > 0);
  const known = rows.filter((r) => r.costFils != null);
  return {
    byKind,
    portions: rows.reduce((s, r) => s + r.portions, 0),
    /** Cost of the records whose cost is known, and how many aren't. */
    knownCostFils: known.reduce((s, r) => s + r.costFils!, 0),
    unknownRecords: rows.length - known.length,
    menuValueFils: rows.reduce((s, r) => s + r.menuValueFils, 0),
  };
}
