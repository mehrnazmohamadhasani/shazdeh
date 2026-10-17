import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { canReadAgain } from "./document-state";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toFils } from "@/lib/ordering/money";
import { readDocument } from "./ai";
import { costLines, grossLines } from "./costing";
import { extractionSchema, isStockCategory, type Extraction } from "./extraction";
import { suggestMatches, type Suggestions } from "./match";
import type { SaveInvoiceInput } from "./save-schema";
import { normalizeName } from "./units";
import { reportError } from "@/lib/report-error";
import { processRecipeDocument } from "./recipe-import";
import { processPlatformDocument } from "./platform-import";
import { chosenCost, getOpsSettings } from "./settings";
import { AiBudgetError } from "./ai-usage";
import { decideInvoiceAutoSave } from "./autosave";

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
type DocumentKind = "supplier_invoice" | "recipe" | "platform_order";

export async function uploadDocument(
  file: { data: Buffer; mimeType: string; name: string | null },
  actor: { id: string; email: string },
  kind: DocumentKind = "supplier_invoice",
) {
  const sha256 = createHash("sha256").update(file.data).digest("hex");
  const existing = await prisma.opsDocument.findUnique({ where: { sha256 }, select: { id: true, status: true, kind: true, updatedAt: true } });
  if (existing) {
    // The same photo again after it was discarded or failed: read it again
    // (as what it was uploaded as now) instead of opening a dead end.
    if (!canReadAgain(existing)) throw new OpsError("This file was already uploaded.", 409, { id: existing.id });
    await reopenDocument(existing, actor, "upload", kind);
    await processDocument(existing.id);
    return existing.id;
  }

  const doc = await prisma.opsDocument.create({
    data: {
      sha256,
      mimeType: file.mimeType,
      sizeBytes: file.data.length,
      data: new Uint8Array(file.data),
      originalName: file.name,
      kind,
      uploadedById: actor.id,
    },
    select: { id: true },
  });
  await processDocument(doc.id);
  return doc.id;
}

/** Puts a discarded / failed / stuck document back to be read, with an audit row saying who and how. */
async function reopenDocument(
  doc: { id: string; status: string; kind: string },
  actor: { email: string },
  how: "upload" | "button",
  kind: DocumentKind = doc.kind as DocumentKind,
) {
  await prisma.$transaction([
    prisma.opsDocument.update({ where: { id: doc.id }, data: { status: "PROCESSING", kind, error: null } }),
    prisma.auditLog.create({
      data: {
        actor: actor.email,
        action: "document.read_again",
        entity: "OpsDocument",
        entityId: doc.id,
        via: how === "upload" ? "photo" : "manual",
        before: { status: doc.status, kind: doc.kind },
        after: { status: "PROCESSING", kind },
      },
    }),
  ]);
}

/** "Read again" from a document's page. Saved documents and ones waiting for review are left alone. */
export async function readAgain(id: string, actor: { email: string }) {
  const doc = await prisma.opsDocument.findUnique({ where: { id }, select: { id: true, status: true, kind: true, updatedAt: true, mimeType: true } });
  if (!doc) throw new OpsError("Document not found.", 404);
  if (doc.status === "SAVED") throw new OpsError("Already saved.", 409);
  if (doc.mimeType === MANUAL_MIME) throw new OpsError("This invoice was typed in — there is no photo to read.");
  // Waiting for review: reading again replaces the reading (as before), no reopening needed.
  if (doc.status !== "NEEDS_REVIEW") {
    if (!canReadAgain(doc)) throw new OpsError("Still reading — refresh in a moment.", 409);
    await reopenDocument(doc, actor, "button");
  }
  await processDocument(id);
}

/** (Re-)reads a document with AI. Never throws: failures are stored on the document. */
export async function processDocument(id: string) {
  const doc = await prisma.opsDocument.findUnique({ where: { id }, select: { data: true, mimeType: true, originalName: true, kind: true } });
  if (!doc) return;
  if (doc.kind === "recipe") return processRecipeDocument(id);
  if (doc.kind === "platform_order") return processPlatformDocument(id);
  await prisma.opsDocument.update({ where: { id }, data: { status: "PROCESSING", error: null } });
  try {
    const result = await readDocument({ data: Buffer.from(doc.data), mimeType: doc.mimeType, name: doc.originalName }, id);
    // A delivery-platform receipt photographed as an invoice: read it as a sale instead.
    if (result.extraction.documentType === "platform_order") return processPlatformDocument(id);
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
    await autoSaveInvoice(id, result.extraction, suggestions);
  } catch (e) {
    if (!(e instanceof AiBudgetError)) await reportError(e, { where: `ops document read ${id}` });
    await prisma.opsDocument.update({
      where: { id },
      data: { status: "FAILED", error: (e instanceof Error ? e.message : String(e)).slice(0, 1000) },
    });
  }
}

/** The person who uploaded a document, acting through auto-save (for createdBy and the audit log). */
export async function autoActor(documentId: string) {
  const doc = await prisma.opsDocument.findUnique({ where: { id: documentId }, select: { uploadedBy: { select: { id: true, email: true } } } });
  const user = doc?.uploadedBy;
  return user ? { id: user.id, email: `auto-save (${user.email})` } : null;
}

/**
 * Saves a clear invoice without review (see ./autosave.ts). Anything
 * uncertain — or a save that fails, e.g. a duplicate — stays in review.
 */
async function autoSaveInvoice(id: string, reading: Extraction, suggestions: Suggestions) {
  try {
    const settings = await getOpsSettings();
    if (!settings.autoSaveInvoices) return;
    const decision = decideInvoiceAutoSave(reading, suggestions, settings.autoSaveMinConfidence);
    if (!decision.ok) return;
    const actor = await autoActor(id);
    if (!actor) return;
    await saveDocument(id, decision.input, actor);
    await prisma.opsDocument.update({ where: { id }, data: { autoSaved: true } });
  } catch (e) {
    // Expected for duplicates and the like: a person sees it in review.
    if (!(e instanceof OpsError)) await reportError(e, { where: `auto-save invoice ${id}` });
  }
}

/** Documents still to check (reading, waiting for review, or failed); saved ones are listed as invoices. */
export async function listDocuments() {
  return prisma.opsDocument.findMany({
    // Recipe photos and platform receipts have their own lists.
    where: { kind: "supplier_invoice", status: { in: ["PROCESSING", "NEEDS_REVIEW", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      autoSaved: true,
      createdAt: true,
      mimeType: true,
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
      kind: true,
      status: true,
      autoSaved: true,
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
          supplier: { select: { name: true, trn: true, phone: true, paymentTermsDays: true } },
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
export async function saveDocument(id: string, input: SaveInvoiceInput, actor: { id: string; email: string }, via = "photo") {
  try {
    return await prisma.$transaction(async (tx) => {
      const doc = await tx.opsDocument.findUnique({ where: { id }, select: { status: true } });
      if (!doc) throw new OpsError("Document not found.", 404);
      if (doc.status === "SAVED") throw new OpsError("This document is already saved.", 409);

      let supplier;
      if (input.supplier.id) {
        const known = await tx.supplier.findUnique({ where: { id: input.supplier.id }, select: { phone: true } });
        supplier = await tx.supplier.update({
          where: { id: input.supplier.id },
          data: {
            ...(input.supplier.trn ? { trn: input.supplier.trn } : {}),
            // Fill a missing phone; never overwrite one someone already entered.
            ...(input.supplier.phone && !known?.phone ? { phone: input.supplier.phone } : {}),
          },
        });
      } else {
        supplier = await tx.supplier.create({
          data: { name: input.supplier.name, trn: input.supplier.trn, phone: input.supplier.phone },
        });
      }

      if (input.invoiceNo) {
        const existing = await tx.purchaseInvoice.findFirst({
          where: { supplierId: supplier.id, invoiceNo: input.invoiceNo, voidedAt: null },
          select: { id: true },
        });
        if (existing) throw new OpsError("An invoice with this number from this supplier is already saved.", 409);
      }

      const at = dubaiDate(input.invoiceDate);
      const costs = costLines(input.lines, { pricesIncludeVat: input.pricesIncludeVat, discount: input.discount });
      const gross = grossLines(
        costs.map((c) => c.netFils),
        { totalFils: toFils(input.total), hasVat: input.pricesIncludeVat || (input.vat ?? 0) > 0 || costs.some((c) => (c.vatFils ?? 0) > 0) },
      );
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

      // Saved again after an edit: keep how it was paid (payer, own money,
      // receipt, and a credit invoice's payment) when the method is unchanged.
      const before = await tx.purchaseInvoice.findFirst({
        where: { voidedDocumentId: id },
        orderBy: { voidedAt: "desc" },
        select: { paymentMode: true, paidAt: true, paidBy: true, paidPersonally: true, paymentNote: true, paymentReceiptId: true, paymentReceiptKind: true },
      });
      const kept = before?.paidAt && before.paymentMode === input.paymentMode ? before : null;
      const paidAt = input.paymentMode && !credit ? at : (kept?.paidAt ?? null);
      const paidBy = (input.paymentMode && !credit ? input.paidBy : null) ?? kept?.paidBy ?? null;

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
          // Cash, card and transfers are paid on the spot; credit waits until marked paid.
          paidAt,
          paidBy,
          // A name on a cash or card payment: paid from their pocket (Owner cash).
          paidPersonally: kept ? kept.paidPersonally : !!paidBy && (input.paymentMode === "cash" || input.paymentMode === "card"),
          paymentNote: kept?.paymentNote ?? null,
          paymentReceiptId: kept?.paymentReceiptId ?? null,
          paymentReceiptKind: kept?.paymentReceiptKind ?? null,
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
            grossFils: gross[i],
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
          via,
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
export async function voidInvoice(invoiceId: string, reason: string, actor: { id: string; email: string }, via = "manual") {
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
      await tx.opsDocument.update({ where: { id: invoice.documentId }, data: { status: "NEEDS_REVIEW", autoSaved: false } });
    }
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "purchase_invoice.void",
        entity: "PurchaseInvoice",
        entityId: invoiceId,
        via,
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
export async function editInvoice(invoiceId: string, actor: { id: string; email: string }, via = "manual") {
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

  await voidInvoice(invoiceId, EDIT_REASON, actor, via);
  await prisma.opsDocument.update({
    where: { id: inv.document.id },
    data: {
      // The AI's first reading is kept next to the values being edited.
      extraction: { reading, suggestions, aiReading: previous?.aiReading ?? previous?.reading ?? null } as unknown as Prisma.InputJsonValue,
    },
  });
  return { documentId: inv.document.id };
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
  const [ingredients, sums, lastPurchases, settings] = await Promise.all([
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
        purchaseLine: { select: { grossFils: true, invoice: { select: { supplier: { select: { name: true } } } } } },
      },
    }),
    getOpsSettings(),
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
            costPerUnitFils:
              last.costFils != null && last.quantity > 0
                ? chosenCost(last.costFils, last.purchaseLine?.grossFils, settings.foodCostIncludesVat)! / last.quantity
                : null,
          }
        : null,
    };
  });
}

// ─── Invoices list, payment, manual entry ───────────────────────────────────

/** A document typed in by hand instead of photographed: no file, the same review and save. */
export const MANUAL_MIME = "application/x-shazdeh-manual";

/**
 * Saved invoices (not undone), newest invoice date first, with what the
 * Invoices screen shows: supplier and phone, payment method and whether
 * it is paid. `unpaid` keeps only the ones not paid yet; `from`/`to`
 * keep one stretch of invoice dates (a month).
 */
export async function listInvoices(opts: { unpaid?: boolean; from?: Date; to?: Date } = {}) {
  return prisma.purchaseInvoice.findMany({
    where: {
      voidedAt: null,
      ...(opts.unpaid ? { paidAt: null } : {}),
      ...(opts.from || opts.to ? { invoiceDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) } } : {}),
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      documentId: true,
      invoiceNo: true,
      invoiceDate: true,
      totalFils: true,
      paymentMode: true,
      paidAt: true,
      paidBy: true,
      paidPersonally: true,
      paymentReceiptId: true,
      paymentReceiptKind: true,
      dueDate: true,
      createdAt: true,
      supplier: { select: { id: true, name: true, phone: true } },
      document: { select: { mimeType: true, autoSaved: true } },
    },
  });
}

/** How many saved invoices each month has ("2026-10" → 12, Dubai months) — for the month picker. */
export async function invoiceMonthCounts() {
  const rows = await prisma.purchaseInvoice.findMany({ where: { voidedAt: null }, select: { invoiceDate: true } });
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const m = new Date(r.invoiceDate.getTime() + 4 * 3_600_000).toISOString().slice(0, 7);
    counts[m] = (counts[m] ?? 0) + 1;
  }
  return counts;
}

export const PAYMENT_METHODS = ["cash", "card", "transfer", "credit"] as const;
/** Proof of payment: a card slip, a bank transfer, or a card-to-card screenshot. */
export const RECEIPT_KINDS = ["card", "bank", "card_to_card"] as const;

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type ReceiptFile = { data: Buffer; mimeType: string; name: string | null };

/** Stores a payment receipt once; the same photo again (one transfer for two invoices) reuses it. */
async function storeReceipt(tx: Tx, file: ReceiptFile, actorId: string) {
  const sha256 = `receipt-${createHash("sha256").update(file.data).digest("hex")}`;
  const existing = await tx.opsDocument.findUnique({ where: { sha256 }, select: { id: true } });
  if (existing) return existing.id;
  const doc = await tx.opsDocument.create({
    data: {
      kind: "payment_receipt",
      status: "SAVED",
      sha256,
      mimeType: file.mimeType,
      sizeBytes: file.data.length,
      data: new Uint8Array(file.data),
      originalName: file.name,
      uploadedById: actorId,
    },
    select: { id: true },
  });
  return doc.id;
}

/** Deletes a receipt no invoice points to any more (one still in an invoice's history is kept). */
async function dropReceiptIfUnused(tx: Tx, id: string) {
  if ((await tx.purchaseInvoice.count({ where: { paymentReceiptId: id } })) === 0) {
    await tx.opsDocument.deleteMany({ where: { id, kind: "payment_receipt" } });
  }
}

/**
 * Sets how an invoice is paid and whether it is paid — the Payment box on
 * the Invoices screen. "credit" (on account) keeps a due date from the
 * supplier's terms; paid or not is a separate tick for every method. A
 * payment made with someone's own money counts in Owner cash as owed to
 * them; a receipt photo can be kept as proof.
 */
export async function setInvoicePayment(
  invoiceId: string,
  input: {
    method: (typeof PAYMENT_METHODS)[number];
    paid: boolean;
    paidOn: string | null;
    paidBy: string | null;
    personal: boolean;
    receiptKind: (typeof RECEIPT_KINDS)[number] | null;
    receipt: ReceiptFile | null;
    removeReceipt: boolean;
  },
  actor: { id: string; email: string },
) {
  if (input.paid && input.personal && !input.paidBy) throw new OpsError("Write who paid with their own money.");
  return prisma.$transaction(async (tx) => {
    const inv = await tx.purchaseInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        invoiceDate: true,
        voidedAt: true,
        paymentMode: true,
        paidAt: true,
        paidBy: true,
        paidPersonally: true,
        dueDate: true,
        paymentReceiptId: true,
        paymentReceiptKind: true,
        supplier: { select: { paymentTermsDays: true } },
      },
    });
    if (!inv) throw new OpsError("Invoice not found.", 404);
    if (inv.voidedAt) throw new OpsError("This invoice is being edited; save it first.", 409);
    const paidAt = input.paid ? (input.paidOn ? dubaiDate(input.paidOn) : inv.paidAt ?? inv.invoiceDate) : null;
    const dueDate =
      input.method === "credit"
        ? (inv.dueDate ?? (inv.supplier.paymentTermsDays != null ? new Date(inv.invoiceDate.getTime() + inv.supplier.paymentTermsDays * DAY_MS) : null))
        : null;
    // Not paid: no payer and no receipt. Otherwise a new photo replaces the old one.
    let receiptId = input.paid && !input.removeReceipt ? inv.paymentReceiptId : null;
    if (input.paid && input.receipt) receiptId = await storeReceipt(tx, input.receipt, actor.id);
    const receiptKind = receiptId ? (input.receiptKind ?? inv.paymentReceiptKind ?? "card") : null;
    const after = {
      paymentMode: input.method,
      paidAt,
      paidBy: input.paid ? input.paidBy : null,
      paidPersonally: input.paid && input.personal,
      paymentReceiptId: receiptId,
      paymentReceiptKind: receiptKind,
    };
    await tx.purchaseInvoice.update({ where: { id: invoiceId }, data: { ...after, dueDate } });
    if (inv.paymentReceiptId && inv.paymentReceiptId !== receiptId) await dropReceiptIfUnused(tx, inv.paymentReceiptId);
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "purchase_invoice.payment",
        entity: "PurchaseInvoice",
        entityId: invoiceId,
        before: {
          paymentMode: inv.paymentMode,
          paidAt: inv.paidAt?.toISOString() ?? null,
          paidBy: inv.paidBy,
          paidPersonally: inv.paidPersonally,
          paymentReceiptId: inv.paymentReceiptId,
          paymentReceiptKind: inv.paymentReceiptKind,
        },
        after: { ...after, paidAt: paidAt?.toISOString() ?? null },
      },
    });
  });
}

/** Starts an invoice typed in by hand: an empty reading on the usual review screen. */
export async function startManualInvoice(actor: { id: string; email: string }) {
  const today = new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10);
  const reading: Extraction = {
    documentType: "supplier_invoice",
    handwritten: false,
    supplier: { name: null, trn: null, phone: null },
    invoiceNumber: null,
    invoiceDate: today,
    paymentMode: null,
    currency: "AED",
    pricesIncludeVat: false,
    lines: [],
    subtotal: null,
    discount: null,
    vat: null,
    total: 0,
    notes: null,
    confidence: 1,
  };
  const suggestions: Suggestions = { supplierId: null, supplierName: null, lines: [] };
  const doc = await prisma.opsDocument.create({
    data: {
      kind: "supplier_invoice",
      status: "NEEDS_REVIEW",
      // No file: a unique marker keeps the dedupe hash out of the way.
      sha256: `manual-${randomUUID()}`,
      mimeType: MANUAL_MIME,
      sizeBytes: 0,
      data: new Uint8Array(),
      originalName: null,
      extraction: { reading, suggestions } as unknown as Prisma.InputJsonValue,
      uploadedById: actor.id,
    },
    select: { id: true },
  });
  await prisma.auditLog.create({ data: { actor: actor.email, action: "document.manual", entity: "OpsDocument", entityId: doc.id } });
  return doc.id;
}
