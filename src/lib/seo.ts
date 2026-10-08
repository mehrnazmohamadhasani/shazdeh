import "server-only";
import { env } from "@/lib/env";
import type { RestaurantSettingsView } from "@/lib/settings";
import { parseOpeningHours } from "@/lib/settings";
import type { SocialLinkView } from "@/lib/social";
import type { MenuCategoryWithItems } from "@/lib/menu";
import type { DishCardData } from "@/lib/dish";

/*
 * schema.org structured data. Rendered with <JsonLd /> so search
 * engines understand SHĀZDEH as a delivery restaurant with a menu.
 */

export function absoluteUrl(path = "/") {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (/^https?:\/\//.test(path)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

const SCHEMA_DAY: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function openingHoursSpecification(raw: string | null) {
  const hours = parseOpeningHours(raw);
  if (!hours) return undefined;
  return hours
    .map((h) => {
      const m = h.hours.match(/(\d{1,2}:\d{2})\s*[—–-]+\s*(\d{1,2}:\d{2})/);
      if (!m || !SCHEMA_DAY[h.day]) return null;
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: SCHEMA_DAY[h.day],
        opens: m[1],
        closes: m[2],
      };
    })
    .filter(Boolean);
}

export function restaurantJsonLd(
  settings: RestaurantSettingsView,
  socials: SocialLinkView[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": absoluteUrl("/#restaurant"),
    name: settings.brandName,
    description: settings.description ?? undefined,
    url: absoluteUrl("/"),
    image: absoluteUrl("/opengraph-image.jpg"),
    logo: absoluteUrl("/icon.png"),
    servesCuisine: ["Persian", "Iranian", "Middle Eastern"],
    telephone: settings.phone ?? undefined,
    email: settings.email ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Dubai",
      addressCountry: "AE",
    },
    areaServed: { "@type": "City", name: "Dubai" },
    hasMenu: absoluteUrl("/menu"),
    acceptsReservations: false,
    openingHoursSpecification: openingHoursSpecification(
      settings.openingHours,
    ),
    sameAs: socials
      .filter((s) => /^https?:/.test(s.url))
      .map((s) => s.url),
  };
}

function offer(dish: DishCardData) {
  return {
    "@type": "Offer",
    price: dish.price.toFixed(2),
    priceCurrency: "AED",
    availability: dish.isAvailable
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
  };
}

function suitableForDiet(dish: DishCardData) {
  return dish.isVegetarian ? "https://schema.org/VegetarianDiet" : undefined;
}

export function menuJsonLd(categories: MenuCategoryWithItems[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: "SHĀZDEH Menu",
    url: absoluteUrl("/menu"),
    inLanguage: "en",
    hasMenuSection: categories.map((c) => ({
      "@type": "MenuSection",
      name: c.name,
      hasMenuItem: c.items.map((i) => ({
        "@type": "MenuItem",
        name: i.name,
        url: absoluteUrl(`/menu/${i.slug}`),
        description: i.description ?? undefined,
        image: i.imageUrl ? absoluteUrl(i.imageUrl) : undefined,
        suitableForDiet: suitableForDiet(i),
        offers: offer(i),
      })),
    })),
  };
}

export function dishJsonLd(dish: DishCardData) {
  return {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    name: dish.name,
    alternateName: dish.nameFa ?? undefined,
    description: dish.description ?? undefined,
    url: absoluteUrl(`/menu/${dish.slug}`),
    image: dish.imageUrl ? absoluteUrl(dish.imageUrl) : undefined,
    suitableForDiet: suitableForDiet(dish),
    offers: offer(dish),
    isPartOf: { "@type": "MenuSection", name: dish.category.name },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
