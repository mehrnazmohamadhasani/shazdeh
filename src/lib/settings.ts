import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type RestaurantSettingsView = {
  brandName: string;
  tagline: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  mapUrl: string | null;
  openingHours: string | null;
  heroVideoUrl: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  metaTitle: string | null;
  metaDesc: string | null;
  ogImageUrl: string | null;
};

const FALLBACK: RestaurantSettingsView = {
  brandName: "SHĀZDEH",
  tagline: "Persian Cuisine",
  description:
    "A contemporary Persian food brand rooted in heritage and expressed through a modern visual language. From our heart to your home.",
  email: null,
  phone: null,
  whatsapp: null,
  address: "Dubai, United Arab Emirates",
  mapUrl: null,
  openingHours: null,
  heroVideoUrl: null,
  logoUrl: null,
  faviconUrl: null,
  metaTitle: "SHĀZDEH — Persian Cuisine · Dubai",
  metaDesc:
    "SHĀZDEH — contemporary Persian cuisine, delivered across Dubai. Slow-cooked khoresh, saffron rice and golden tahdig, from our heart to your home.",
  ogImageUrl: null,
};

/**
 * Settings are read by the root metadata, the site layout and most
 * pages in the same request — `cache` collapses those into one query.
 */
export const getSettings = cache(
  async (): Promise<RestaurantSettingsView> => {
    try {
      const row = await prisma.restaurantSettings.findUnique({
        where: { id: "default" },
      });
      if (!row) return FALLBACK;
      return {
        brandName: row.brandName,
        tagline: row.tagline,
        description: row.description,
        email: row.email,
        phone: row.phone,
        whatsapp: row.whatsapp,
        address: row.address,
        mapUrl: row.mapUrl,
        openingHours: row.openingHours,
        heroVideoUrl: row.heroVideoUrl,
        logoUrl: row.logoUrl,
        faviconUrl: row.faviconUrl,
        metaTitle: row.metaTitle,
        metaDesc: row.metaDesc,
        ogImageUrl: row.ogImageUrl,
      };
    } catch (e) {
      console.error("[settings] falling back to defaults:", e);
      return FALLBACK;
    }
  },
);

export type OpeningHours = { day: string; label: string; hours: string }[];

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Opening hours are stored as a JSON object keyed by day. */
export function parseOpeningHours(raw: string | null): OpeningHours | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const entries = Object.entries(obj as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" && v.trim() !== "")
      .map(([day, hours]) => ({
        day: day.toLowerCase(),
        label: DAY_LABEL[day.toLowerCase()] ?? day,
        hours: String(hours),
      }));
    entries.sort(
      (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day),
    );
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}

/**
 * Collapses a week into ranges when every day shares the same hours
 * ("Daily · 11:00 — 22:45"), which reads far better than seven rows.
 */
export function summariseHours(hours: OpeningHours): string | null {
  const unique = new Set(hours.map((h) => h.hours));
  if (hours.length === 7 && unique.size === 1) return hours[0].hours;
  return null;
}
