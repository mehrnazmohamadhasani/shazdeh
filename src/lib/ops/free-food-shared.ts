import { z } from "zod";

/*
 * Free food: dishes that leave the kitchen without a sale. Shared by the
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

export const freeFoodSchema = z.object({
  kind: z.enum(FREE_FOOD_KINDS),
  /** Dubai day; null = today. */
  day: day.nullable().default(null),
  items: z
    .array(z.object({ menuItemId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(50) }))
    .min(1, "Add at least one dish.")
    .max(30),
  recipient: z.string().trim().max(80).nullable().default(null),
  reason: z.string().trim().max(200).nullable().default(null),
});
export type FreeFoodInput = z.infer<typeof freeFoodSchema>;

/** Food cost of the lines; unknown (null) as soon as one dish has no cost — never counted as zero. */
export function freeFoodTotals(lines: { quantity: number; unitCostFils: number | null; menuPriceFils: number }[]) {
  const costKnown = lines.every((l) => l.unitCostFils != null);
  return {
    costFils: costKnown ? lines.reduce((s, l) => s + l.quantity * l.unitCostFils!, 0) : null,
    menuValueFils: lines.reduce((s, l) => s + l.quantity * l.menuPriceFils, 0),
    portions: lines.reduce((s, l) => s + l.quantity, 0),
  };
}

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
