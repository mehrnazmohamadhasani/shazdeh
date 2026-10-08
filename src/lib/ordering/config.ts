import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { kitchenStatus } from "@/lib/ordering/hours";
import { toFils } from "@/lib/ordering/money";
import { getOnlineProvider } from "@/lib/payments";
import type { OrderingConfig } from "@/lib/ordering/types";

/** SHĀZDEH cooks in Dubai; every hours calculation uses this clock. */
export const KITCHEN_TIMEZONE = "Asia/Dubai";

export type OrderingSettingsRow = Awaited<ReturnType<typeof loadRow>>;

const DEFAULTS = {
  id: "default",
  acceptingOrders: false,
  pausedMessage: null as string | null,
  deliveryHours: null as string | null,
  kitchenLat: null as number | null,
  kitchenLng: null as number | null,
  vatRate: 5,
  pricesIncludeVat: true,
  serviceFee: 0,
  paymentMethods: ["CASH_ON_DELIVERY", "CARD_ON_DELIVERY"] as (
    | "CASH_ON_DELIVERY"
    | "CARD_ON_DELIVERY"
    | "ONLINE"
  )[],
  deliveryModel: "OWN_FLEET" as "OWN_FLEET" | "THIRD_PARTY" | "HYBRID",
  autoAccept: false,
  notifyEmail: null as string | null,
  legalName: null as string | null,
  tradeLicenseNo: null as string | null,
  licensingAuthority: null as string | null,
  trn: null as string | null,
};

async function loadRow() {
  try {
    const row = await prisma.orderingSettings.findUnique({ where: { id: "default" } });
    return row ?? DEFAULTS;
  } catch (e) {
    // Ordering fails closed: if settings can't be read, nobody can order.
    console.error("[ordering] settings unavailable:", e);
    return DEFAULTS;
  }
}

export const getOrderingSettings = cache(loadRow);

/** Hours that gate ordering: delivery hours, else the site's opening hours. */
export async function getEffectiveHours() {
  const [row, site] = await Promise.all([getOrderingSettings(), getSettings()]);
  return { hours: row.deliveryHours ?? site.openingHours, timezone: KITCHEN_TIMEZONE };
}

export async function getOrderingConfig(now = new Date()): Promise<OrderingConfig> {
  const row = await getOrderingSettings();
  const { hours, timezone } = await getEffectiveHours();
  const status = kitchenStatus(hours, timezone, now);
  const provider = getOnlineProvider();
  const methods = row.paymentMethods.filter((m) => m !== "ONLINE" || provider);
  return {
    acceptingOrders: row.acceptingOrders,
    pausedMessage: row.pausedMessage,
    kitchenOpen: status.isOpen,
    kitchenLabel: status.label,
    canOrder: row.acceptingOrders && status.isOpen && methods.length > 0,
    vatRate: row.vatRate,
    pricesIncludeVat: row.pricesIncludeVat,
    serviceFeeFils: toFils(row.serviceFee),
    paymentMethods: methods,
    onlineProviderLabel: provider?.label ?? null,
  };
}
