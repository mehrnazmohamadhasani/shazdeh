import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { splitPortion } from "@/lib/dish";
import { toFils } from "@/lib/ordering/money";
import type { PricingGroup, PricingItem } from "@/lib/ordering/pricing";
import type { OrderCategory, OrderProduct } from "@/lib/ordering/types";

const ITEM_SELECT = {
  id: true,
  slug: true,
  name: true,
  nameFa: true,
  description: true,
  ingredients: true,
  allergens: true,
  price: true,
  imageUrl: true,
  isVegetarian: true,
  isAvailable: true,
  isActive: true,
  order: true,
  modifierGroups: {
    orderBy: { order: "asc" as const },
    select: {
      id: true,
      name: true,
      minSelect: true,
      maxSelect: true,
      options: {
        orderBy: { order: "asc" as const },
        select: { id: true, name: true, price: true, isAvailable: true },
      },
    },
  },
} as const;

type GroupRow = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: { id: string; name: string; price: number; isAvailable: boolean }[];
};

function toGroups(rows: GroupRow[]): PricingGroup[] {
  return rows
    .map((g) => ({
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: Math.max(g.minSelect, g.maxSelect),
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceFils: toFils(o.price),
        isAvailable: o.isAvailable,
      })),
    }))
    .filter((g) => g.options.length > 0);
}

const PORTION_ORDER = ["small", "regular", "medium", "large", "family"];

/**
 * The orderable menu. Disabled dishes (isActive=false) are left out;
 * sold-out dishes stay visible but cannot be added.
 */
export const getOrderMenu = cache(async (): Promise<OrderCategory[]> => {
  try {
    return await loadOrderMenu();
  } catch (e) {
    // Degrade like the rest of the site; the page revalidates within 30s.
    console.error("[ordering] menu unavailable:", e);
    return [];
  }
});

async function loadOrderMenu(): Promise<OrderCategory[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: {
      slug: true,
      name: true,
      items: {
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: ITEM_SELECT,
      },
    },
  });

  return categories
    .map((c) => {
      const byTitle = new Map<string, OrderProduct>();
      for (const item of c.items) {
        const { title, portion } = splitPortion(item.name);
        const key = title.toLowerCase();
        let product = byTitle.get(key);
        if (!product) {
          product = {
            key: item.slug,
            title,
            nameFa: item.nameFa?.replace(/\s*\((?:بزرگ|کوچک|متوسط)\)\s*$/, "") ?? null,
            description: item.description,
            ingredients: item.ingredients,
            allergens: item.allergens,
            imageUrl: item.imageUrl,
            isVegetarian: item.isVegetarian,
            categorySlug: c.slug,
            categoryName: c.name,
            fromPriceFils: toFils(item.price),
            variants: [],
          };
          byTitle.set(key, product);
        }
        product.imageUrl ??= item.imageUrl;
        product.description ??= item.description;
        product.variants.push({
          itemId: item.id,
          slug: item.slug,
          portion,
          priceFils: toFils(item.price),
          orderable: item.isAvailable,
          groups: toGroups(item.modifierGroups),
        });
      }
      const products = [...byTitle.values()].map((p) => {
        p.variants.sort((a, b) => {
          const ia = PORTION_ORDER.indexOf(a.portion?.toLowerCase() ?? "");
          const ib = PORTION_ORDER.indexOf(b.portion?.toLowerCase() ?? "");
          return ia - ib || a.priceFils - b.priceFils;
        });
        const prices = p.variants.filter((v) => v.orderable).map((v) => v.priceFils);
        p.fromPriceFils = prices.length ? Math.min(...prices) : p.variants[0].priceFils;
        return p;
      });
      return { slug: c.slug, name: c.name, products };
    })
    .filter((c) => c.products.length > 0);
}

/** Fresh pricing rows for the given dish ids — the server's source of truth. */
export async function loadPricingItems(ids: string[]): Promise<Map<string, PricingItem>> {
  const unique = [...new Set(ids)].slice(0, 100);
  const rows = await prisma.menuItem.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      name: true,
      price: true,
      isAvailable: true,
      isActive: true,
      category: { select: { isActive: true } },
      modifierGroups: ITEM_SELECT.modifierGroups,
    },
  });
  return new Map(
    rows.map((r) => {
      const { title, portion } = splitPortion(r.name);
      return [
        r.id,
        {
          id: r.id,
          name: title,
          portion,
          priceFils: toFils(r.price),
          orderable: r.isActive && r.isAvailable && r.category.isActive,
          groups: toGroups(r.modifierGroups),
        },
      ];
    }),
  );
}
