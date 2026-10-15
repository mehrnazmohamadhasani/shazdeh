import "server-only";
import { prisma } from "@/lib/prisma";

/*
 * How the kitchen's numbers are worked out (single row, id "default").
 * The owner chooses whether food cost includes the VAT paid to suppliers:
 * off when SHĀZDEH reclaims input VAT, on when it doesn't.
 */

export async function getOpsSettings() {
  return (
    (await prisma.opsSettings.findUnique({ where: { id: "default" } })) ??
    prisma.opsSettings.create({ data: { id: "default" } }).catch(() => prisma.opsSettings.findUniqueOrThrow({ where: { id: "default" } }))
  );
}

/** Cost of a purchase line or movement as food cost counts it. */
export function chosenCost(netFils: number | null, grossFils: number | null | undefined, withVat: boolean): number | null {
  return withVat && grossFils != null ? grossFils : netFils;
}

type SettingsUpdate = { foodCostIncludesVat?: boolean; aiMonthlyCapUsd?: number; autoSavePlatform?: boolean; autoSaveInvoices?: boolean };
const pick = (s: SettingsUpdate) => ({
  foodCostIncludesVat: s.foodCostIncludesVat,
  aiMonthlyCapUsd: s.aiMonthlyCapUsd,
  autoSavePlatform: s.autoSavePlatform,
  autoSaveInvoices: s.autoSaveInvoices,
});

export async function updateOpsSettings(data: SettingsUpdate, actor: { email: string }) {
  const before = await getOpsSettings();
  return prisma.$transaction(async (tx) => {
    const after = await tx.opsSettings.update({ where: { id: "default" }, data });
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "ops_settings.update",
        entity: "OpsSettings",
        entityId: "default",
        before: pick(before),
        after: pick(after),
      },
    });
    return pick(after);
  });
}
