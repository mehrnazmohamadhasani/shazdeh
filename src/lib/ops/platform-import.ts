import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/report-error";
import { readWithSchema, AiNotConfiguredError } from "./ai";
import { AiBudgetError } from "./ai-usage";
import { OpsError, autoActor } from "./documents";
import { decidePlatformAutoSave } from "./autosave";
import { getOpsSettings } from "./settings";
import { aliasKey, draftFromReading, foodSales, type LearnedAlias, type MenuEntry } from "./platform";
import { PLATFORM_PROMPT, platformReadingJsonSchema, platformReadingSchema, samplePlatformReading, type PlatformReading } from "./platform-reading";
import type { SavePlatformOrderInput } from "./platform-save-schema";
import { recordSaleUse, reverseSaleUse } from "./stock-use";

/*
 * Platform receipts: photo → AI reading → a person confirms the sale →
 * PlatformOrder. The photo stays linked to the order for audit. Confirmed
 * dish names are remembered per platform (MenuItemAlias), so the next
 * receipt from that platform matches by itself.
 */

type Actor = { id: string; email: string };

/** What OpsDocument.extraction holds for a platform receipt. */
export type StoredPlatformReading = { platform: PlatformReading };

export function parseStoredPlatform(value: unknown): PlatformReading | null {
  if (!value || typeof value !== "object") return null;
  const parsed = platformReadingSchema.safeParse((value as { platform?: unknown }).platform);
  return parsed.success ? parsed.data : null;
}

/** Reads a platform receipt with AI. Never throws: failures are stored on the document. */
export async function processPlatformDocument(id: string) {
  const doc = await prisma.opsDocument.findUnique({ where: { id }, select: { data: true, mimeType: true, originalName: true } });
  if (!doc) return;
  await prisma.opsDocument.update({ where: { id }, data: { kind: "platform_order", status: "PROCESSING", error: null } });
  try {
    let reading: PlatformReading;
    let meta: { model: string; inputTokens: number | null; outputTokens: number | null };
    if (!process.env.OPENAI_API_KEY?.trim()) {
      if (process.env.NODE_ENV === "production") throw new AiNotConfiguredError();
      reading = samplePlatformReading();
      meta = { model: "sample (no OPENAI_API_KEY)", inputTokens: null, outputTokens: null };
    } else {
      const result = await readWithSchema(
        { data: Buffer.from(doc.data), mimeType: doc.mimeType, name: doc.originalName },
        { instructions: PLATFORM_PROMPT, prompt: "Read this receipt.", schemaName: "platform_receipt", jsonSchema: platformReadingJsonSchema, usage: { kind: "platform", documentId: id } },
      );
      const parsed = platformReadingSchema.safeParse(result.json);
      if (!parsed.success) throw new Error(`The reading didn't match the expected shape: ${parsed.error.message.slice(0, 300)}`);
      reading = parsed.data;
      meta = { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
    }
    const stored: StoredPlatformReading = { platform: reading };
    await prisma.opsDocument.update({
      where: { id },
      data: { status: "NEEDS_REVIEW", extraction: stored as unknown as Prisma.InputJsonValue, aiModel: meta.model, aiInputTokens: meta.inputTokens, aiOutputTokens: meta.outputTokens },
    });
    await autoSavePlatform(id, reading);
  } catch (e) {
    if (!(e instanceof AiBudgetError)) await reportError(e, { where: `platform receipt read ${id}` });
    await prisma.opsDocument.update({ where: { id }, data: { status: "FAILED", error: (e instanceof Error ? e.message : String(e)).slice(0, 1000) } });
  }
}

/**
 * Saves a clear receipt without review (see ./autosave.ts). If the save
 * is refused (most often: the same order was saved already) the reason
 * stays on the receipt for the person who checks it.
 */
async function autoSavePlatform(id: string, reading: PlatformReading) {
  try {
    const settings = await getOpsSettings();
    if (!settings.autoSavePlatform) return;
    const [menu, aliasesFor] = await Promise.all([menuEntries(), learnedAliases()]);
    const draft = draftFromReading(reading, menu, aliasesFor);
    const decision = decidePlatformAutoSave(reading, draft, menu, settings.autoSaveMinConfidence);
    if (!decision.ok) return;
    const actor = await autoActor(id);
    if (!actor) return;
    await savePlatformOrder(id, decision.input, actor);
    await prisma.opsDocument.update({ where: { id }, data: { autoSaved: true } });
  } catch (e) {
    if (e instanceof OpsError) await prisma.opsDocument.update({ where: { id }, data: { error: e.message.slice(0, 1000) } });
    else await reportError(e, { where: `auto-save platform receipt ${id}` });
  }
}

// ─── Review ─────────────────────────────────────────────────────────────────

/** The active menu in the shape matching needs. */
export async function menuEntries(): Promise<MenuEntry[]> {
  const items = await prisma.menuItem.findMany({
    where: { isActive: true },
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
    select: { id: true, name: true, price: true, isVegetarian: true, category: { select: { name: true } } },
  });
  return items.map((i) => ({ id: i.id, name: i.name, category: i.category.name, priceFils: Math.round(i.price * 100), isVegetarian: i.isVegetarian }));
}

async function learnedAliases() {
  const rows = await prisma.menuItemAlias.findMany({ select: { rawName: true, menuItemId: true, channel: { select: { code: true } } } });
  return (channelCode: string | null): LearnedAlias[] =>
    rows.map((r) => ({ key: r.rawName, menuItemId: r.menuItemId, sameChannel: r.channel.code === channelCode }));
}

export async function channelsList() {
  return prisma.channel.findMany({ orderBy: { order: "asc" }, select: { id: true, code: true, name: true, kind: true, isActive: true } });
}

/** Everything the review screen needs for one receipt. */
export async function getPlatformDocument(id: string) {
  const doc = await prisma.opsDocument.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      status: true,
      autoSaved: true,
      createdAt: true,
      mimeType: true,
      extraction: true,
      error: true,
      platformOrder: { include: { channel: true, items: { include: { menuItem: { select: { id: true, name: true, category: { select: { name: true } } } } } } } },
    },
  });
  if (!doc) return null;
  const reading = parseStoredPlatform(doc.extraction);
  const [menu, aliasesFor, channels] = await Promise.all([menuEntries(), learnedAliases(), channelsList()]);
  const draft = reading ? draftFromReading(reading, menu, aliasesFor) : null;
  return { doc, reading, draft, menu, channels };
}

// ─── Save / undo ────────────────────────────────────────────────────────────

const toFils = (aed: number) => Math.round(aed * 100);

export async function savePlatformOrder(documentId: string | null, input: SavePlatformOrderInput, actor: Actor) {
  const placedAt = new Date(`${input.placedAt}:00+04:00`);
  const businessDate = new Date(`${input.placedAt.slice(0, 10)}T00:00:00Z`);
  try {
    return await prisma.$transaction(async (tx) => {
      if (documentId) {
        const doc = await tx.opsDocument.findUnique({ where: { id: documentId }, select: { status: true, kind: true } });
        if (!doc) throw new OpsError("Receipt not found.", 404);
        if (doc.status === "SAVED") throw new OpsError("This receipt is already saved.", 409);
      }
      const channel = await tx.channel.findUnique({ where: { code: input.channelCode } });
      if (!channel || channel.kind !== "PLATFORM") throw new OpsError("Choose a delivery platform.");

      // Same order twice (another photo of the same receipt, or a reprint).
      const dup = await tx.platformOrder.findFirst({
        where: {
          channelId: channel.id,
          OR: [{ orderNo: input.orderNo, businessDate }, ...(input.altOrderId ? [{ altOrderId: input.altOrderId }] : [])],
        },
        select: { id: true, documentId: true },
      });
      if (dup) throw new OpsError(`${channel.name} order #${input.orderNo} is already saved.`, 409, { orderId: dup.id, documentId: dup.documentId });

      const menuIds = input.items.map((i) => i.menuItemId).filter((x): x is string => !!x);
      const menu = await tx.menuItem.findMany({ where: { id: { in: menuIds } }, select: { id: true, price: true } });
      const priceOf = (id: string | null) => {
        const p = id ? menu.find((m) => m.id === id)?.price : undefined;
        return p == null ? null : Math.round(p * 100);
      };
      if (menuIds.some((id) => !menu.some((m) => m.id === id))) {
        throw new OpsError("A chosen dish is no longer on the menu — choose again.");
      }

      const items = input.items.map((i) => {
        const menuPriceFils = priceOf(i.menuItemId);
        const printed = i.lineTotal == null ? null : toFils(i.lineTotal);
        return {
          rawName: i.rawName,
          category: i.category,
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          lineTotalFils: printed ?? (menuPriceFils != null ? menuPriceFils * i.quantity : null),
          priceFromMenu: printed == null && menuPriceFils != null,
          menuPriceFils,
        };
      });
      const totalFils = toFils(input.total);
      const sales = foodSales({
        subtotalFils: input.subtotal == null ? null : toFils(input.subtotal),
        deliveryFeeFils: input.deliveryFee == null ? null : toFils(input.deliveryFee),
        serviceFeeFils: input.serviceFee == null ? null : toFils(input.serviceFee),
        discountFils: toFils(input.discount),
        totalFils,
        items: items.map((i) => ({ lineTotalFils: i.priceFromMenu ? null : i.lineTotalFils, quantity: i.quantity, menuPriceFils: i.menuPriceFils })),
      });
      if (!sales) throw new OpsError("The food sale can't be worked out: enter the subtotal or choose each dish.");

      const order = await tx.platformOrder.create({
        data: {
          channelId: channel.id,
          orderNo: input.orderNo,
          altOrderId: input.altOrderId,
          businessDate,
          placedAt,
          fulfilment: input.fulfilment,
          payment: input.payment,
          foodSalesFils: sales.fils,
          salesSource: sales.source,
          subtotalFils: input.subtotal == null ? null : toFils(input.subtotal),
          deliveryFeeFils: input.deliveryFee == null ? null : toFils(input.deliveryFee),
          serviceFeeFils: input.serviceFee == null ? null : toFils(input.serviceFee),
          discountFils: toFils(input.discount),
          discountFundedBy: input.discountFundedBy,
          totalFils,
          customerFirstName: input.customerFirstName?.split(/\s+/)[0] || null,
          note: input.note,
          documentId,
          createdById: actor.id,
          items: {
            create: items.map((i) => ({
              rawName: i.rawName,
              category: i.category,
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              lineTotalFils: i.lineTotalFils,
              priceFromMenu: i.priceFromMenu,
            })),
          },
        },
      });

      // The dishes leave stock now (approved recipes only).
      const stock = await recordSaleUse(
        tx,
        { platformOrderId: order.id },
        { at: placedAt, label: `${channel.name} #${input.orderNo}`, items: input.items.map((i) => ({ menuItemId: i.menuItemId, name: i.rawName, quantity: i.quantity })), actorId: actor.id },
      );

      // Remember how this platform names each dish.
      for (const i of input.items) {
        if (!i.menuItemId) continue;
        const rawName = aliasKey(i.rawName, i.category);
        await tx.menuItemAlias.upsert({
          where: { channelId_rawName: { channelId: channel.id, rawName } },
          create: { channelId: channel.id, rawName, menuItemId: i.menuItemId },
          update: { menuItemId: i.menuItemId },
        });
      }

      if (documentId) await tx.opsDocument.update({ where: { id: documentId }, data: { status: "SAVED" } });
      await tx.auditLog.create({
        data: {
          actor: actor.email,
          action: "platform_order.create",
          entity: "PlatformOrder",
          entityId: order.id,
          via: documentId ? "photo" : "manual",
          after: {
            channel: channel.code,
            orderNo: input.orderNo,
            placedAt: input.placedAt,
            foodSalesFils: sales.fils,
            totalFils,
            items: input.items.length,
            documentId,
            stockUsedFor: stock.used,
            stockNotUsed: stock.skipped.map((s) => `${s.name}: ${s.reason}`),
          },
        },
      });
      return order;
    });
  } catch (e) {
    // Two people saving the same receipt at once: the unique index catches the second.
    if ((e as { code?: string }).code === "P2002") throw new OpsError(`Order #${input.orderNo} is already saved.`, 409);
    throw e;
  }
}

/** Removes a saved platform order; its receipt goes back to "check" so it can be corrected and saved again. */
export async function undoPlatformOrder(orderId: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.platformOrder.findUnique({ where: { id: orderId }, include: { channel: true, items: true } });
    if (!order) throw new OpsError("Order not found.", 404);
    const returned = await reverseSaleUse(tx, orderId, `Undo ${order.channel.name} #${order.orderNo}`, actor.id);
    await tx.platformOrder.delete({ where: { id: orderId } });
    if (order.documentId) await tx.opsDocument.update({ where: { id: order.documentId }, data: { status: "NEEDS_REVIEW", autoSaved: false } });
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "platform_order.undo",
        entity: "PlatformOrder",
        entityId: orderId,
        before: {
          channel: order.channel.code,
          orderNo: order.orderNo,
          placedAt: order.placedAt.toISOString(),
          foodSalesFils: order.foodSalesFils,
          totalFils: order.totalFils,
          items: order.items.map((i) => ({ rawName: i.rawName, menuItemId: i.menuItemId, quantity: i.quantity, lineTotalFils: i.lineTotalFils })),
          documentId: order.documentId,
          stockMovementsReturned: returned,
        },
      },
    });
    return { documentId: order.documentId };
  });
}
