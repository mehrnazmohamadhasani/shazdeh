import "server-only";
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
  email: "hello@shazdeh.ae",
  phone: "+971 4 000 0000",
  whatsapp: "+971500000000",
  address: "Dubai, United Arab Emirates",
  mapUrl: "https://maps.google.com/?q=Dubai",
  openingHours: JSON.stringify({
    mon: "12:00 — 23:00",
    tue: "12:00 — 23:00",
    wed: "12:00 — 23:00",
    thu: "12:00 — 23:00",
    fri: "12:00 — 00:00",
    sat: "12:00 — 00:00",
    sun: "12:00 — 23:00",
  }),
  heroVideoUrl: null,
  logoUrl: null,
  faviconUrl: null,
  metaTitle: "SHĀZDEH — Persian Cuisine · Dubai",
  metaDesc:
    "SHĀZDEH — a contemporary Persian food brand in Dubai. Persian cuisine, refined hospitality, editorial dining.",
  ogImageUrl: null,
};

export async function getSettings(): Promise<RestaurantSettingsView> {
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
  } catch {
    return FALLBACK;
  }
}
