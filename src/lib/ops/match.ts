import "server-only";
import { prisma } from "@/lib/prisma";
import { isStockCategory, type Extraction } from "./extraction";
import { lineNet } from "./costing";
import { choosePack, packFromBase, packOptions, packStock, readPack, type Pack } from "./pack";
import { normalizeName, type BaseUnit } from "./units";

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
  /**
   * Raw meat: which kind (lamb, beef…) — the linked ingredient's own, else the
   * one the reading named. Null: not raw meat. Missing on older readings.
   */
  meatTypeId?: string | null;
  /** How one invoice unit is packed, most likely first; empty when a person must say. Missing on older readings. */
  packs?: Pack[];
  /** The pack chosen: remembered, the only one possible, or the one the last price fits. */
  pack?: Pack | null;
  /** False: more than one pack fits (or none does) — a person checks. */
  packSure?: boolean;
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
        include: { ingredient: { select: { id: true, name: true, unit: true, meatTypeId: true } } },
      })
    : [];
  const stockLines = x.lines.filter((l) => isStockCategory(l.category));
  const [ingredients, meatTypes, lastBuys] = await Promise.all([
    prisma.ingredient.findMany({ select: { id: true, name: true, unit: true, meatTypeId: true } }),
    prisma.meatType.findMany({ where: { isActive: true }, select: { id: true, name: true, nameFa: true, countPieces: true } }),
    // The last price paid per g / pc (ex VAT): it tells "a tub" from "a box of six".
    stockLines.length
      ? prisma.stockMovement.findMany({
          where: { type: { in: ["PURCHASE", "OPENING"] }, reversedBy: null, costFils: { not: null }, quantity: { gt: 0 } },
          orderBy: { at: "desc" },
          distinct: ["ingredientId"],
          select: { ingredientId: true, costFils: true, quantity: true },
        })
      : [],
  ]);
  const lastPrice = (ingredientId: string | undefined) => {
    const m = ingredientId ? lastBuys.find((b) => b.ingredientId === ingredientId) : undefined;
    return m ? m.costFils! / m.quantity : null;
  };
  // The reading names one of the kinds of meat; match it by name (any case or language).
  const meatTypeFor = (named: string | null | undefined) => {
    const n = named?.trim().toLowerCase();
    if (!n) return null;
    return meatTypes.find((m) => m.name.toLowerCase() === n || m.nameFa?.trim() === named?.trim())?.id ?? null;
  };

  const lines = x.lines.map((l): LineSuggestion => {
    if (!isStockCategory(l.category)) {
      return { ingredientId: null, ingredientName: null, unit: null, quantity: null, source: null, meatTypeId: null };
    }
    const memory = learned.find((m) => m.rawName === normalizeName(l.description));
    if (memory && l.quantity != null) {
      const unit = UNIT_FROM_DB[memory.ingredient.unit];
      const pack = readPack(memory.pack) ?? packFromBase(memory.baseQtyPerUnit, unit);
      return {
        ingredientId: memory.ingredient.id,
        ingredientName: memory.ingredient.name,
        unit,
        quantity: l.quantity * memory.baseQtyPerUnit,
        source: "learned",
        meatTypeId: memory.ingredient.meatTypeId ?? meatTypeFor(l.meat),
        packs: [pack],
        pack,
        packSure: true,
      };
    }
    const description = normalizeName(l.description);
    const known = ingredients.find((i) => {
      const n = normalizeName(i.name);
      return description === n || description.split(" ").includes(n) || (n.length > 3 && description.includes(n));
    });
    const meatTypeId = known?.meatTypeId ?? meatTypeFor(l.meat);
    // Butchers print "33" and a price per kg: meat by weight with no unit on the line is kilos.
    const byKilo = !!meatTypeId && !meatTypes.find((m) => m.id === meatTypeId)?.countPieces && (!known || known.unit === "G");
    // The AI's pack first when the printed text allows it (or says nothing), then what the text allows.
    const printed = packOptions(l, { meat: byKilo });
    const ai = l.pack && (!printed.length || printed.some((p) => sameStock(p, l.pack!))) ? [l.pack] : [];
    const packs = [...ai, ...printed.filter((p) => !ai.some((a) => sameStock(a, p)))];
    const net = l.quantity != null && l.lineTotal != null ? lineNet({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount ?? 0, vat: l.vat, lineTotal: l.lineTotal }, x.pricesIncludeVat ?? false).net : null;
    // The AI's pack goes first, but where the paper allows two (a tub, or a box of six?) only
    // the last price may settle it: the AI is confidently wrong about exactly these.
    const { pack, sure } = choosePack(packs, l.quantity, net, lastPrice(known?.id));
    const chosen = { pack };
    const stock = chosen.pack && l.quantity != null ? packStock(l.quantity, chosen.pack) : null;
    const unit = stock?.base ?? l.stockUnit ?? (known ? UNIT_FROM_DB[known.unit] : null);
    return {
      ingredientId: known?.id ?? null,
      ingredientName: known?.name ?? null,
      unit,
      quantity: stock?.amount ?? l.stockQuantity ?? null,
      source: stock ? (ai.length && chosen.pack === ai[0] ? "ai" : "parsed") : l.stockQuantity != null ? "ai" : null,
      meatTypeId,
      packs,
      pack,
      packSure: sure,
    };
  });

  return { supplierId: supplier?.id ?? null, supplierName: supplier?.name ?? null, lines };
}

const sameStock = (a: Pack, b: Pack) => {
  const x = packStock(1, a);
  const y = packStock(1, b);
  return x.base === y.base && Math.abs(x.amount - y.amount) < 1e-6;
};
