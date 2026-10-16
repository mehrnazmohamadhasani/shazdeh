import "server-only";
import { prisma } from "@/lib/prisma";
import { dubaiMonthStart } from "./ai-price";
import { OpsError } from "./documents";
import { estimateFees, type FeeRule } from "./platform";

/*
 * One view of sales across channels: website orders (Order) and platform
 * orders (PlatformOrder). Food sales are what SHĀZDEH sold — never the
 * customer's delivery or service fees. Platform fees are estimated from
 * the fee rule valid on each order's day; with no rule they are unknown,
 * and the net is not shown as if it were known.
 */

type Actor = { id: string; email: string };

/** Website orders that count as sales (paid or being made / delivered). */
const COUNTED = ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

type Rule = FeeRule & { channelId: string; validFrom: Date; validTo: Date | null };

/** The rule valid on a day: the latest one starting on or before it. */
export function ruleOn(rules: Rule[], channelId: string, day: Date): Rule | null {
  return (
    rules
      .filter((r) => r.channelId === channelId && r.validFrom <= day && (!r.validTo || r.validTo >= day))
      .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0] ?? null
  );
}

/** "2026-10" → that Dubai month's start and end (exclusive). Defaults to the current month. */
export function monthRange(month?: string | null) {
  const start = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T00:00:00+04:00`) : dubaiMonthStart(new Date());
  const next = new Date(start.getTime() + 32 * 86_400_000);
  const end = dubaiMonthStart(next);
  const key = new Date(start.getTime() + 4 * 3_600_000).toISOString().slice(0, 7);
  return { start, end, key };
}

export async function salesOverview(month?: string | null) {
  const { start, end, key } = monthRange(month);
  const [channels, rules, platformOrders, direct, pending] = await Promise.all([
    prisma.channel.findMany({ orderBy: { order: "asc" } }),
    prisma.channelFeeRule.findMany(),
    prisma.platformOrder.findMany({
      where: { placedAt: { gte: start, lt: end } },
      orderBy: { placedAt: "desc" },
      include: { channel: { select: { code: true, name: true } }, items: { select: { quantity: true } }, document: { select: { autoSaved: true } } },
    }),
    // Direct orders, split by where they came from (website, WhatsApp, phone).
    prisma.order.groupBy({
      by: ["source"],
      where: { placedAt: { gte: start, lt: end }, status: { in: [...COUNTED] } },
      _count: true,
      _sum: { subtotalFils: true, discountFils: true },
    }),
    prisma.opsDocument.findMany({
      where: { kind: "platform_order", status: { in: ["PROCESSING", "NEEDS_REVIEW", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, error: true, extraction: true },
    }),
  ]);

  const byChannel = channels.map((c) => {
    if (c.kind === "DIRECT") {
      const sources = (["WEBSITE", "WHATSAPP", "PHONE"] as const)
        .map((source) => {
          const g = direct.find((d) => d.source === source);
          return { source, orders: g?._count ?? 0, foodSalesFils: (g?._sum.subtotalFils ?? 0) - (g?._sum.discountFils ?? 0) };
        })
        .filter((x) => x.orders > 0);
      const orders = sources.reduce((n, x) => n + x.orders, 0);
      return {
        code: c.code,
        name: c.name,
        orders,
        foodSalesFils: sources.reduce((n, x) => n + x.foodSalesFils, 0),
        feesFils: 0 as number | null,
        feesKnownFor: orders,
        sources,
      };
    }
    const mine = platformOrders.filter((o) => o.channelId === c.id);
    let fees = 0;
    let known = 0;
    for (const o of mine) {
      const est = estimateFees(ruleOn(rules, c.id, o.businessDate), o.foodSalesFils);
      if (est) {
        fees += est.totalFils;
        known++;
      }
    }
    return {
      code: c.code,
      name: c.name,
      orders: mine.length,
      foodSalesFils: mine.reduce((s, o) => s + o.foodSalesFils, 0),
      feesFils: mine.length && known === mine.length ? fees : null,
      feesKnownFor: known,
    };
  });

  return {
    month: key,
    byChannel,
    orders: platformOrders.map((o) => {
      const est = estimateFees(ruleOn(rules, o.channelId, o.businessDate), o.foodSalesFils);
      return { ...o, dishes: o.items.reduce((s, i) => s + i.quantity, 0), feesFils: est?.totalFils ?? null };
    }),
    pending,
  };
}

// ─── Fee rules ──────────────────────────────────────────────────────────────

export async function channelsWithRules() {
  return prisma.channel.findMany({ orderBy: { order: "asc" }, include: { feeRules: { orderBy: { validFrom: "desc" } }, _count: { select: { orders: true } } } });
}

export async function addFeeRule(
  channelId: string,
  input: { validFrom: string; commissionPct: number | null; paymentFeePct: number | null; fixedFeeFils: number | null; vatOnFees: boolean; note: string | null },
  actor: Actor,
) {
  return prisma.$transaction(async (tx) => {
    const channel = await tx.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new OpsError("Channel not found.", 404);
    if (channel.kind !== "PLATFORM") throw new OpsError("Website orders have no platform fees.");
    const rule = await tx.channelFeeRule.create({
      data: {
        channelId,
        validFrom: new Date(`${input.validFrom}T00:00:00Z`),
        commissionPct: input.commissionPct,
        paymentFeePct: input.paymentFeePct,
        fixedFeeFils: input.fixedFeeFils,
        vatOnFees: input.vatOnFees,
        note: input.note,
        createdById: actor.id,
      },
    });
    await tx.auditLog.create({
      data: { actor: actor.email, action: "channel_fee_rule.create", entity: "ChannelFeeRule", entityId: rule.id, after: { channel: channel.code, ...input } },
    });
    return rule;
  });
}

export async function deleteFeeRule(ruleId: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const rule = await tx.channelFeeRule.findUnique({ where: { id: ruleId }, include: { channel: { select: { code: true } } } });
    if (!rule) throw new OpsError("Fee terms not found.", 404);
    await tx.channelFeeRule.delete({ where: { id: ruleId } });
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "channel_fee_rule.delete",
        entity: "ChannelFeeRule",
        entityId: ruleId,
        before: {
          channel: rule.channel.code,
          validFrom: rule.validFrom.toISOString().slice(0, 10),
          commissionPct: rule.commissionPct,
          paymentFeePct: rule.paymentFeePct,
          fixedFeeFils: rule.fixedFeeFils,
          vatOnFees: rule.vatOnFees,
          note: rule.note,
        },
      },
    });
  });
}
