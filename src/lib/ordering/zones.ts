import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { toFils } from "@/lib/ordering/money";
import { getOrderingSettings } from "@/lib/ordering/config";
import type { ZoneTerms } from "@/lib/ordering/pricing";
import type { OrderArea } from "@/lib/ordering/types";
import { distanceKm } from "@/lib/ordering/geo";

/*
 * Delivery coverage. Customers pick the community they live in (how
 * addresses work in Dubai); each community belongs to one zone that
 * carries the fee, minimum order and delivery-time window. If the
 * customer shares their location and both the zone radius and the
 * kitchen coordinates are configured, the distance is checked too.
 */

export function toZoneTerms(z: {
  id: string;
  name: string;
  fee: number;
  minOrder: number;
  freeDeliveryOver: number | null;
  etaMin: number;
  etaMax: number;
}): ZoneTerms {
  return {
    id: z.id,
    name: z.name,
    feeFils: toFils(z.fee),
    minOrderFils: toFils(z.minOrder),
    freeOverFils: z.freeDeliveryOver === null ? null : toFils(z.freeDeliveryOver),
    etaMin: z.etaMin,
    etaMax: z.etaMax,
  };
}

export const getDeliveryNetwork = cache(async (): Promise<{ zones: ZoneTerms[]; areas: OrderArea[] }> => {
  try {
    const zones = await prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: { areas: { where: { isActive: true }, orderBy: [{ order: "asc" }, { name: "asc" }] } },
    });
    return {
      zones: zones.map(toZoneTerms),
      areas: zones
        .flatMap((z) =>
          z.areas.map((a) => ({ id: a.id, name: a.name, zoneId: z.id, lat: a.lat, lng: a.lng })),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (e) {
    console.error("[zones] unavailable:", e);
    return { zones: [], areas: [] };
  }
});

export type DeliveryResolution =
  | { ok: true; area: { id: string; name: string }; zone: ZoneTerms }
  | { ok: false; reason: string };

export async function resolveDelivery(
  areaId: string | null | undefined,
  lat?: number | null,
  lng?: number | null,
): Promise<DeliveryResolution> {
  if (!areaId) return { ok: false, reason: "Choose your area to see delivery options." };
  const area = await prisma.deliveryArea.findUnique({
    where: { id: areaId },
    include: { zone: true },
  });
  if (!area || !area.isActive || !area.zone.isActive) {
    return { ok: false, reason: "Sorry — we don't deliver to this area yet." };
  }
  if (lat != null && lng != null && area.zone.radiusKm) {
    const settings = await getOrderingSettings();
    if (settings.kitchenLat != null && settings.kitchenLng != null) {
      const d = distanceKm(settings.kitchenLat, settings.kitchenLng, lat, lng);
      if (d > area.zone.radiusKm) {
        return {
          ok: false,
          reason: "Your pinned location is outside our delivery range for this area.",
        };
      }
    }
  }
  return { ok: true, area: { id: area.id, name: area.name }, zone: toZoneTerms(area.zone) };
}
