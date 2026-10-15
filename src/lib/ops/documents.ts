import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toFils } from "@/lib/ordering/money";
import { readDocument } from "./ai";
import { costLines } from "./costing";
import { extractionSchema, isStockCategory, type Extraction } from "./extraction";
import { suggestMatches, type Suggestions } from "./match";
import type { SaveInvoiceInput } from "./save-schema";
import { normalizeName } from "./units";
import { reportError } from "@/lib/report-error";
import { processRecipeDocument } from "./recipe-import";

/*
 * Purchase documents: upload → AI reading → review → saved invoice and
 * stock. Every saved invoice keeps a link to its original file and an
 * audit entry; stock only ever changes through StockMovement rows.
 */

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** What OpsDocument.extraction holds. */
export type StoredReading = { reading: Extraction; suggestions: Suggestions };

export function parseStoredReading(value: unknown): StoredReading | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { reading?: unknown; suggestions?: Suggestions };
  const reading = extractionSchema.safeParse(v.reading);
  return reading.success && v.suggestions ? { reading: reading.data, suggestions: v.suggestions } : null;
}

export class OpsError extends Error {
  constructor(
    message: string,
    public status = 400,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Stores the file (once — duplicates are caught by hash) and reads it. */
export async function uploadDocument(
  file: { data: Buffer; mimeType: string; name: string | null },
  userId: string,
  kind: "supplier_invoice" | "recipe" = "supplier_invoice",
) {
  const sha256 = createHash("sha256").update(file.data).digest("hex");
  const existing = await prisma.opsDocument.findUnique({ where: { sha256 }, select: { id: true } });
  if (existing) throw new OpsError("This file was already uploaded.", 409, { id: existing.id });

  const doc = await prisma.opsDocument.create({
    data: {
      sha256,
      mimeType: file.mimeType,
      sizeBytes: file.data.length,
      data: new Uint8Array(file.data),
      originalName: file.name,
      kind,
      uploadedById: userId,
    },
    select: { id: true },
  });
  await processDocument(doc.id);
  return doc.id;
}

/** (Re-)reads a document with AI. Never throws: failures are stored on the document. */
export async function processDocument(id: string) {
  const doc = await prisma.opsDocument.findUnique({ where: { id }, select: { data: true, mimeType: true, originalName: true, kind: true } });
  if (!doc) return;
  if (doc.kind === "recipe") return processRecipeDocument(id);
  await prisma.opsDocument.update({ where: { id }, data: { status: "PROCESSING", error: null } });
  try {
    const result = await readDocument({ data: Buffer.from(doc.data), mimeType: doc.mimeType, name: doc.originalName });
    const suggestions = await suggestMatches(result.extraction);
    const stored: StoredReading = { reading: result.extraction, suggestions };
    await prisma.opsDocument.update({
      where: { id },
      data: {
        status: "NEEDS_REVIEW",
        extraction: stored as unknown as Prisma.InputJsonValue,
        aiModel: result.model,
        aiInputTokens: result.inputTokens,
        aiOutputTokens: result.outputTokens,
      },
    });
  } catch (e) {
    await reportError(e, { where: `ops document read ${id}` });
    await prisma.opsDocument.update({
      where: { id },
      data: { status: "FAILED", error: (e instanceof Error ? e.message : String(e)).slice(0, 1000) },
    });
  }
}

export async function listDocuments() {
  return prisma.opsDocument.findMany({
    // Recipe photos have their own list on the recipes screen.
    where: { kind: { not: "recipe" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      createdAt: true,
      originalName: true,
      extraction: true,
      error: true,
      invoice: { select: { totalFils: true, invoiceDate: true, supplier: { select: { name: true } } } },
    },
  });
}

export async function getDocument(id: string) {
  return prisma.opsDocument.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      createdAt: true,
      mimeType: true,
      originalName: true,
      extraction: true,
      aiModel: true,
      error: true,
      uploadedBy: { select: { email: true, name: true } },
      voidedInvoices: { orderBy: { voidedAt: "desc" }, take: 1, select: { voidedAt: true, voidReason: true } },
      invoice: {
        include: {
          supplier: { select: { name: true } },
          lines: { include: { ingredient: { select: { name: true, unit: true } } } },
        },
      },
    },
  });
}

const DB_UNIT = { g: "G", ml: "ML", pcs: "PCS" } as const;
const DB_CATEGORY = { food: "FOOD", packaging: "PACKAGING", supplies: "SUPPLIES", smallwares: "SMALLWARES", delivery: "DELIVERY", other: "OTHER" } as const;

/** Noon in Dubai on the given day — a date without a time zone surprise. */
export function dubaiDate(day: string) {
  return new Date(`${day}T12:00:00+04:00`);
}

const DAY_MS = 86_400_000;

/** Saves a reviewed reading as a purchase invoice, its stock and what was learned. */
export async function saveDocument(id: string, input: SaveInvoiceInput, actor: { id: string; email: string }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const doc = await tx.opsDocument.findUnique({ where: { id }, select: { status: true } });
      if (!doc) throw new OpsError("Document not found.", 404);
      if (doc.status === "SAVED") throw new OpsError("This document is already saved.", 409);

      const supplier = input.supplier.id
        ? await tx.supplier.update({
            where: { id: input.supplier.id },
            data: input.supplier.trn ? { trn: input.supplier.trn } : {},
          })
        : await tx.supplier.create({ data: { name: input.supplier.name, trn: input.supplier.trn } });

      if (input.invoiceNo) {
        const existing = await tx.purchaseInvoice.findFirst({
          where: { supplierId: supplier.id, invoiceNo: input.invoiceNo, voidedAt: null },
          select: { id: true },
        });
        if (existing) throw new OpsError("An invoice with this number from this supplier is already saved.", 409);
      }

      const at = dubaiDate(input.invoiceDate);
      const costs = costLines(input.lines, { pricesIncludeVat: input.pricesIncludeVat, discount: input.discount });
      const credit = input.paymentMode === "credit";
      const dueDate = credit
        ? input.dueDate
          ? dubaiDate(input.dueDate)
          : supplier.paymentTermsDays != null
            ? new Date(at.getTime() + supplier.paymentTermsDays * DAY_MS)
            : null
        : null;
      const ingredientIds: (string | null)[] = [];
      for (const line of input.lines) {
        if (!line.ingredient) {
          ingredientIds.push(null);
          continue;
        }
        const unit = DB_UNIT[line.ingredient.unit];
        let ingredient = line.ingredient.id
          ? await tx.ingredient.findUnique({ where: { id: line.ingredient.id } })
          : await tx.ingredient.findFirst({ where: { name: { equals: line.ingredient.name, mode: "insensitive" } } });
        if (!ingredient) {
          ingredient = await tx.ingredient.create({
            data: { name: line.ingredient.name, unit, category: line.category === "packaging" ? "PACKAGING" : line.category === "supplies" ? "SUPPLIES" : "FOOD" },
          });
        }
        if (ingredient.unit !== unit) {
          throw new OpsError(`"${ingredient.name}" is counted in ${ingredient.unit.toLowerCase()}, not ${line.ingredient.unit}.`);
        }
        ingredientIds.push(ingredient.id);
      }

      const invoice = await tx.purchaseInvoice.create({
        data: {
          documentId: id,
          supplierId: supplier.id,
          invoiceNo: input.invoiceNo,
          invoiceDate: at,
          paymentMode: input.paymentMode,
          pricesIncludeVat: input.pricesIncludeVat,
          subtotalFils: input.subtotal == null ? null : toFils(input.subtotal),
          discountFils: toFils(input.discount),
          vatFils: input.vat == null ? null : toFils(input.vat),
          totalFils: toFils(input.total),
          notes: input.notes,
          dueDate,
          // Cash, card and transfers are paid on the spot; credit waits in payables.
          paidAt: input.paymentMode && !credit ? at : null,
          paidBy: input.paymentMode && !credit ? input.paidBy : null,
          createdById: actor.id,
        },
      });

      let movements = 0;
      for (const [i, line] of input.lines.entries()) {
        const ingredientId = ingredientIds[i];
        const stocked = ingredientId && line.stockQuantity && isStockCategory(line.category);
        const created = await tx.purchaseLine.create({
          data: {
            invoiceId: invoice.id,
            rawName: line.rawName,
            itemCode: line.itemCode,
            quantity: line.quantity,
            unit: line.unit,
            unitPriceFils: line.unitPrice == null ? null : toFils(line.unitPrice),
            discountFils: toFils(Math.abs(line.discount)),
            vatFils: costs[i].vatFils,
            lineTotalFils: toFils(line.lineTotal),
            netFils: costs[i].netFils,
            category: DB_CATEGORY[line.category],
            ingredientId,
            baseQty: stocked ? line.stockQuantity : null,
          },
        });
        if (stocked) {
          await tx.stockMovement.create({
            data: {
              ingredientId: ingredientId!,
              type: "PURCHASE",
              quantity: line.stockQuantity!,
              costFils: costs[i].netFils,
              at,
              purchaseLineId: created.id,
              createdById: actor.id,
            },
          });
          movements++;
          // Remember this supplier's item for next time.
          await tx.supplierItem.upsert({
            where: { supplierId_rawName: { supplierId: supplier.id, rawName: normalizeName(line.rawName) } },
            create: {
              supplierId: supplier.id,
              rawName: normalizeName(line.rawName),
              ingredientId: ingredientId!,
              baseQtyPerUnit: line.stockQuantity! / line.quantity,
            },
            update: { ingredientId: ingredientId!, baseQtyPerUnit: line.stockQuantity! / line.quantity },
          });
        }
      }

      await tx.opsDocument.update({ where: { id }, data: { status: "SAVED" } });
      await tx.auditLog.create({
        data: {
          actor: actor.email,
          action: "purchase_invoice.create",
          entity: "PurchaseInvoice",
          entityId: invoice.id,
          via: "photo",
          after: {
            documentId: id,
            supplier: supplier.name,
            invoiceNo: input.invoiceNo,
            total: input.total,
            lines: input.lines.length,
            stockMovements: movements,
          },
        },
      });
      return { invoiceId: invoice.id, movements };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new OpsError("This document was saved at the same time by someone else.", 409);
    }
    throw e;
  }
}

/**
 * Undo a saved invoice: every stock movement it made is cancelled by an
 * opposite movement (history is never deleted), the invoice is marked
 * voided, and its document goes back to review so it can be fixed and
 * saved again.
 */
export async function voidInvoice(invoiceId: string, reason: string, actor: { id: string; email: string }) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { include: { movement: { include: { reversedBy: { select: { id: true } } } } } } },
    });
    if (!invoice) throw new OpsError("Invoice not found.", 404);
    if (invoice.voidedAt) throw new OpsError("This invoice is already undone.", 409);

    const now = new Date();
    let reversed = 0;
    for (const line of invoice.lines) {
      const m = line.movement;
      if (!m || m.reversedBy) continue;
      await tx.stockMovement.create({
        data: {
          ingredientId: m.ingredientId,
          type: "ADJUSTMENT",
          quantity: -m.quantity,
          costFils: m.costFils == null ? null : -m.costFils,
          at: now,
          reversesId: m.id,
          note: `Undo invoice${invoice.invoiceNo ? ` ${invoice.invoiceNo}` : ""}: ${reason}`,
          createdById: actor.id,
        },
      });
      reversed++;
    }
    await tx.purchaseInvoice.update({
      where: { id: invoiceId },
      data: { voidedAt: now, voidReason: reason, documentId: null, voidedDocumentId: invoice.documentId },
    });
    if (invoice.documentId) {
      await tx.opsDocument.update({ where: { id: invoice.documentId }, data: { status: "NEEDS_REVIEW" } });
    }
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "purchase_invoice.void",
        entity: "PurchaseInvoice",
        entityId: invoiceId,
        before: { voidedAt: null, stockMovements: reversed },
        after: { voidedAt: now.toISOString(), reason },
      },
    });
    return { documentId: invoice.documentId, reversed };
  });
}

/** Why an invoice was voided when someone pressed "Edit" (shown on the review screen). */
export const EDIT_REASON = "Edited";

/**
 * "Edit" on a saved invoice: puts its saved values (not the AI's first
 * reading) back on the review screen, then takes the invoice and its
 * stock out until it is saved again. History is kept: the old invoice
 * stays as voided and the edit is audited.
 */
export async function editInvoice(invoiceId: string, actor: { id: string; email: string }) {
  const inv = await prisma.purchaseInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      supplier: true,
      lines: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
      document: { select: { id: true, extraction: true } },
    },
  });
  if (!inv) throw new OpsError("Invoice not found.", 404);
  if (inv.voidedAt) throw new OpsError("This invoice is already being edited.", 409);
  if (!inv.document) throw new OpsError("This invoice has no document to edit.", 409);

  const aed = (fils: number | null) => (fils == null ? null : fils / 100);
  const unitOf = { G: "g", ML: "ml", PCS: "pcs" } as const;
  const reading: Extraction = {
    documentType: "supplier_invoice",
    handwritten: false,
    supplier: { name: inv.supplier.name, trn: inv.supplier.trn, phone: inv.supplier.phone },
    invoiceNumber: inv.invoiceNo,
    invoiceDate: new Date(inv.invoiceDate.getTime() + 4 * 3_600_000).toISOString().slice(0, 10),
    paymentMode: (inv.paymentMode as Extraction["paymentMode"]) ?? null,
    currency: "AED",
    pricesIncludeVat: inv.pricesIncludeVat,
    lines: inv.lines.map((l) => ({
      description: l.rawName,
      itemCode: l.itemCode,
      quantity: l.quantity,
      unit: l.unit,
      packSize: null,
      unitPrice: aed(l.unitPriceFils),
      discount: aed(l.discountFils) || null,
      vat: aed(l.vatFils),
      lineTotal: aed(l.lineTotalFils),
      category: l.category.toLowerCase() as Extraction["lines"][number]["category"],
      stockUnit: l.ingredient ? unitOf[l.ingredient.unit] : null,
      stockQuantity: l.baseQty,
      confidence: 1,
      note: null,
    })),
    subtotal: aed(inv.subtotalFils),
    discount: aed(inv.discountFils) || null,
    vat: aed(inv.vatFils),
    total: aed(inv.totalFils)!,
    notes: inv.notes,
    confidence: 1,
  };
  const suggestions: Suggestions = {
    supplierId: inv.supplierId,
    supplierName: inv.supplier.name,
    lines: inv.lines.map((l) => ({
      ingredientId: l.ingredient?.id ?? null,
      ingredientName: l.ingredient?.name ?? null,
      unit: l.ingredient ? unitOf[l.ingredient.unit] : null,
      quantity: l.baseQty,
      source: l.ingredient ? ("learned" as const) : null,
    })),
  };
  const previous = inv.document.extraction as { reading?: unknown; aiReading?: unknown } | null;

  await voidInvoice(invoiceId, EDIT_REASON, actor);
  await prisma.opsDocument.update({
    where: { id: inv.document.id },
    data: {
      // The AI's first reading is kept next to the values being edited.
      extraction: { reading, suggestions, aiReading: previous?.aiReading ?? previous?.reading ?? null } as unknown as Prisma.InputJsonValue,
    },
  });
  return { documentId: inv.document.id };
}

/** Record payment of a credit invoice. */
export async function markInvoicePaid(
  invoiceId: string,
  input: { paidOn: string; paidBy: string | null; note: string | null },
  actor: { email: string },
) {
  const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: invoiceId }, select: { paidAt: true, voidedAt: true } });
  if (!invoice) throw new OpsError("Invoice not found.", 404);
  if (invoice.voidedAt) throw new OpsError("This invoice was undone.", 409);
  if (invoice.paidAt) throw new OpsError("Already marked as paid.", 409);
  const paidAt = dubaiDate(input.paidOn);
  await prisma.$transaction(async (tx) => {
    // Conditional update: of two clicks at the same moment, only one
    // marks it paid (and writes the audit entry); the other gets a 409.
    const { count } = await tx.purchaseInvoice.updateMany({
      where: { id: invoiceId, paidAt: null, voidedAt: null },
      data: { paidAt, paidBy: input.paidBy, paymentNote: input.note },
    });
    if (count === 0) throw new OpsError("Already marked as paid.", 409);
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "purchase_invoice.pay",
        entity: "PurchaseInvoice",
        entityId: invoiceId,
        before: { paidAt: null },
        after: { paidAt: paidAt.toISOString(), paidBy: input.paidBy, note: input.note },
      },
    });
  });
}

export async function discardDocument(id: string, actor: { email: string }) {
  const doc = await prisma.opsDocument.findUnique({ where: { id }, select: { status: true } });
  if (!doc) throw new OpsError("Document not found.", 404);
  if (doc.status === "SAVED") throw new OpsError("Saved documents can't be discarded.", 409);
  await prisma.$transaction([
    prisma.opsDocument.update({ where: { id }, data: { status: "DISCARDED" } }),
    prisma.auditLog.create({ data: { actor: actor.email, action: "document.discard", entity: "OpsDocument", entityId: id } }),
  ]);
}

/** Stock on hand per ingredient (sum of movements) with the last purchase. */
export async function stockSummary() {
  const [ingredients, sums, lastPurchases] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.groupBy({ by: ["ingredientId"], _sum: { quantity: true } }),
    prisma.stockMovement.findMany({
      // The opening stock's value counts as a price until the first purchase.
      where: { type: { in: ["PURCHASE", "OPENING"] }, reversedBy: null },
      orderBy: { at: "desc" },
      distinct: ["ingredientId"],
      select: {
        ingredientId: true,
        at: true,
        quantity: true,
        costFils: true,
        purchaseLine: { select: { invoice: { select: { supplier: { select: { name: true } } } } } },
      },
    }),
  ]);
  return ingredients.map((i) => {
    const last = lastPurchases.find((p) => p.ingredientId === i.id);
    return {
      id: i.id,
      name: i.name,
      nameFa: i.nameFa,
      unit: i.unit,
      category: i.category,
      onHand: sums.find((s) => s.ingredientId === i.id)?._sum.quantity ?? 0,
      lastPurchase: last
        ? {
            at: last.at.toISOString(),
            supplier: last.purchaseLine?.invoice.supplier.name ?? null,
            costPerUnitFils: last.costFils != null && last.quantity > 0 ? last.costFils / last.quantity : null,
          }
        : null,
    };
  });
}
