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
 * carries the fee, minimum order and delivery-time window. Once the
 * kitchen location is set, delivery goes by distance instead (see
 * deliversByDistance) and nobody needs to know the community names.
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
      select: {
        id: true,
        name: true,
        fee: true,
        minOrder: true,
        freeDeliveryOver: true,
        etaMin: true,
        etaMax: true,
        areas: { select: { id: true, name: true, lat: true, lng: true } },
      },
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

/** Where the kitchen is, when set. Server-side only — never sent to customers. */
async function kitchenPoint() {
  const s = await getOrderingSettings();
  return s.kitchenLat != null && s.kitchenLng != null ? { lat: s.kitchenLat, lng: s.kitchenLng } : null;
}

/**
 * Delivery by distance: with the kitchen location set, customers pin
 * where they are and the zones with a max distance work as rings around
 * the kitchen — the smallest ring that reaches them sets fee and timing.
 */
export async function deliversByDistance() {
  return (await kitchenPoint()) != null;
}

/** The zone a pinned location falls in. Only the zone is returned, never the distance. */
export async function locateDelivery(lat: number, lng: number): Promise<DeliveryResolution> {
  const kitchen = await kitchenPoint();
  if (!kitchen) return { ok: false, reason: "Choose your area to see delivery options." };
  const d = distanceKm(kitchen.lat, kitchen.lng, lat, lng);
  const zone = await prisma.deliveryZone.findFirst({
    where: { isActive: true, radiusKm: { gte: d } },
    orderBy: { radiusKm: "asc" },
    include: { areas: { orderBy: { name: "asc" }, take: 1 } },
  });
  if (!zone) return { ok: false, reason: "Sorry — this address is outside our delivery range." };
  const area = zone.areas[0];
  if (!area) {
    console.error(`[zones] zone "${zone.name}" has no area to order under`);
    return { ok: false, reason: "Delivery to this address isn't set up yet." };
  }
  return { ok: true, area: { id: area.id, name: area.name }, zone: toZoneTerms(zone) };
}

/**
 * `requirePin`: website checkout. When delivering by distance it must
 * come with a pinned location; staff entering a phone order may pick
 * the zone's area by hand.
 */
export async function resolveDelivery(
  areaId: string | null | undefined,
  lat?: number | null,
  lng?: number | null,
  { requirePin = false }: { requirePin?: boolean } = {},
): Promise<DeliveryResolution> {
  if (await deliversByDistance()) {
    if (lat != null && lng != null) return locateDelivery(lat, lng);
    if (requirePin) return { ok: false, reason: "Pin your delivery location to see delivery options." };
  }
  if (!areaId) return { ok: false, reason: "Choose your area to see delivery options." };
  const area = await prisma.deliveryArea.findUnique({
    where: { id: areaId },
    include: { zone: true },
  });
  if (!area || !area.zone.isActive) {
    return { ok: false, reason: "Sorry — we don't deliver to this area yet." };
  }
  return { ok: true, area: { id: area.id, name: area.name }, zone: toZoneTerms(area.zone) };
}
