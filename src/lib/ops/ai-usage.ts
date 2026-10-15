import "server-only";
import { prisma } from "@/lib/prisma";
import { sendPush } from "@/lib/notifications/push";
import { reportError } from "@/lib/report-error";
import { aiCostMicroUsd, aiPrices, dubaiMonth, dubaiMonthStart } from "./ai-price";
import { getOpsSettings } from "./settings";

/*
 * Every AI call is logged with its estimated cost. Once the month's spend
 * reaches the owner's limit (Ops settings), reading stops until the next
 * month; at 80 % the admins get one push warning per month.
 */

export class AiBudgetError extends Error {
  constructor(capUsd: number) {
    super(`This month's AI limit (US$ ${capUsd}) is used up. Raise it in Ops settings, or try again next month.`);
  }
}

export async function aiSpendThisMonth(now = new Date()) {
  const sum = await prisma.aiUsage.aggregate({ where: { at: { gte: dubaiMonthStart(now) } }, _sum: { costMicroUsd: true }, _count: true });
  return { usd: (sum._sum.costMicroUsd ?? 0) / 1_000_000, calls: sum._count };
}

/** Throws AiBudgetError when this month's spend has reached the limit. */
export async function assertAiBudget() {
  const [settings, spent] = await Promise.all([getOpsSettings(), aiSpendThisMonth()]);
  if (spent.usd >= settings.aiMonthlyCapUsd) throw new AiBudgetError(settings.aiMonthlyCapUsd);
}

export async function recordAiUsage(entry: { kind: "invoice" | "recipe" | "platform"; model: string; inputTokens: number | null; outputTokens: number | null; documentId?: string | null }) {
  const inputTokens = entry.inputTokens ?? 0;
  const outputTokens = entry.outputTokens ?? 0;
  await prisma.aiUsage.create({
    data: {
      kind: entry.kind,
      model: entry.model,
      inputTokens,
      outputTokens,
      costMicroUsd: aiCostMicroUsd(inputTokens, outputTokens, aiPrices()),
      documentId: entry.documentId ?? null,
    },
  });
  await warnNearCap().catch((e) => reportError(e, { where: "ai usage warning" }));
}

async function warnNearCap() {
  const [settings, spent] = await Promise.all([getOpsSettings(), aiSpendThisMonth()]);
  const month = dubaiMonth(new Date());
  if (settings.aiMonthlyCapUsd <= 0 || spent.usd < settings.aiMonthlyCapUsd * 0.8 || settings.aiWarnedMonth === month) return;
  // Only the request that flips the month wins, so the warning goes out once.
  const claimed = await prisma.opsSettings.updateMany({
    where: { id: "default", OR: [{ aiWarnedMonth: null }, { aiWarnedMonth: { not: month } }] },
    data: { aiWarnedMonth: month },
  });
  if (claimed.count === 0) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { user: { role: "ADMIN" } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length) {
    await sendPush(subs, {
      title: "AI reading: 80 % of this month's limit used",
      body: `US$ ${spent.usd.toFixed(2)} of ${settings.aiMonthlyCapUsd} spent. Reading stops at the limit.`,
      url: "/admin/ops/settings",
      tag: `ai-cap-${month}`,
    });
  }
}
