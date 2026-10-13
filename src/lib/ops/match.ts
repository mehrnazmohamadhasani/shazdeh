import "server-only";
import { prisma } from "@/lib/prisma";
import type { Extraction } from "./extraction";
import { lineStockAmount, normalizeName, type BaseUnit } from "./units";

/*
 * Links a fresh reading to what SHĀZDEH already knows: the supplier (by
 * TRN, then name) and, per line, the ingredient and pack size the owner
 * confirmed last time this supplier sent the same item. That memory
 * (SupplierItem) is how a supplier gets more accurate with every upload.
 */

export type LineSuggestion = {
  ingredientId: string | null;
  ingredientName: string | null;
  unit: BaseUnit | null;
  quantity: number | null;
  /** learned = remembered from an earlier confirmation; parsed = worked out from the printed pack size; ai = the model's estimate */
  source: "learned" | "parsed" | "ai" | null;
};

export type Suggestions = {
  supplierId: string | null;
  supplierName: string | null;
  lines: LineSuggestion[];
};

const UNIT_FROM_DB = { G: "g", ML: "ml", PCS: "pcs" } as const;

export async function suggestMatches(x: Extraction): Promise<Suggestions> {
  const trn = x.supplier.trn?.replace(/\D/g, "") || null;
  const name = x.supplier.name ? normalizeName(x.supplier.name) : null;
  const suppliers = trn || name ? await prisma.supplier.findMany({ select: { id: true, name: true, trn: true } }) : [];
  const supplier =
    (trn && suppliers.find((s) => s.trn?.replace(/\D/g, "") === trn)) ||
    (name && suppliers.find((s) => normalizeName(s.name) === name)) ||
    (name && suppliers.find((s) => name.includes(normalizeName(s.name)) || normalizeName(s.name).includes(name))) ||
    null;

  const learned = supplier
    ? await prisma.supplierItem.findMany({
        where: { supplierId: supplier.id, rawName: { in: x.lines.map((l) => normalizeName(l.description)) } },
        include: { ingredient: { select: { id: true, name: true, unit: true } } },
      })
    : [];
  const ingredients = await prisma.ingredient.findMany({ select: { id: true, name: true, unit: true } });

  const lines = x.lines.map((l): LineSuggestion => {
    if (l.category !== "food" && l.category !== "packaging") {
      return { ingredientId: null, ingredientName: null, unit: null, quantity: null, source: null };
    }
    const memory = learned.find((m) => m.rawName === normalizeName(l.description));
    if (memory && l.quantity != null) {
      return {
        ingredientId: memory.ingredient.id,
        ingredientName: memory.ingredient.name,
        unit: UNIT_FROM_DB[memory.ingredient.unit],
        quantity: l.quantity * memory.baseQtyPerUnit,
        source: "learned",
      };
    }
    const description = normalizeName(l.description);
    const known = ingredients.find((i) => {
      const n = normalizeName(i.name);
      return description === n || description.split(" ").includes(n) || (n.length > 3 && description.includes(n));
    });
    const parsed = lineStockAmount(l);
    const unit = parsed?.unit ?? l.stockUnit ?? (known ? UNIT_FROM_DB[known.unit] : null);
    return {
      ingredientId: known?.id ?? null,
      ingredientName: known?.name ?? null,
      unit,
      quantity: parsed?.amount ?? l.stockQuantity ?? null,
      source: parsed ? "parsed" : l.stockQuantity != null ? "ai" : null,
    };
  });

  return { supplierId: supplier?.id ?? null, supplierName: supplier?.name ?? null, lines };
}
