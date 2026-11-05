import type { Prisma } from "@/generated/prisma/client";

/*
 * Where an ingredient's price comes from: its latest purchase or valued
 * opening stock (cost ÷ quantity), or a price corrected by hand on the
 * ingredient page (a PRICE entry: stock unchanged, price per unit kept).
 * Whichever is newest wins.
 */
export const PRICED = {
  OR: [
    { type: { in: ["PURCHASE", "OPENING"] }, reversedBy: null, costFils: { not: null }, quantity: { gt: 0 } },
    { type: "PRICE", unitCostFils: { not: null } },
  ],
} satisfies Prisma.StockMovementWhereInput;

export type PricedMovement = {
  type: string;
  costFils: number | null;
  quantity: number;
  unitCostFils: number | null;
  purchaseLine?: { grossFils: number | null } | null;
};

/** Fils per g / ml / pc; with VAT when the owner chose that and the invoice says it. */
export function filsPerUnit(m: PricedMovement, withVat: boolean): number {
  if (m.type === "PRICE") return m.unitCostFils!;
  const cost = withVat && m.purchaseLine?.grossFils != null ? m.purchaseLine.grossFils : m.costFils!;
  return cost / m.quantity;
}
