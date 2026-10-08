import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { toDishCard, type DishCardData } from "@/lib/dish";

export type { DishCardData } from "@/lib/dish";

export type MenuCategoryWithItems = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  imageUrl: string | null;
  order: number;
  items: DishCardData[];
};

const DISH_SELECT = {
  id: true,
  slug: true,
  name: true,
  nameFa: true,
  description: true,
  story: true,
  ingredients: true,
  allergens: true,
  price: true,
  currency: true,
  imageUrl: true,
  spicyLevel: true,
  isVegetarian: true,
  isBestseller: true,
  isNew: true,
  isSignature: true,
  isAvailable: true,
} as const;

export const getMenuTree = cache(
  async (): Promise<MenuCategoryWithItems[]> => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: {
        items: { where: { isActive: true }, orderBy: { order: "asc" }, select: DISH_SELECT },
      },
    });

    return categories
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        description: c.description,
        imageUrl: c.imageUrl,
        order: c.order,
        items: c.items.map((i) =>
          toDishCard(i, { name: c.name, slug: c.slug }),
        ),
      }))
      .filter((c) => c.items.length > 0);
  },
);

/**
 * Signature & bestselling dishes for the home page. Driven by the
 * admin flags (not hard-coded names) so the section never renders
 * half-empty when a dish is renamed.
 */
export async function getFeaturedDishes(limit = 4): Promise<DishCardData[]> {
  try {
    const items = await prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        isActive: true,
        imageUrl: { not: null },
        category: { isActive: true },
        OR: [{ isSignature: true }, { isBestseller: true }],
      },
      select: {
        ...DISH_SELECT,
        category: { select: { name: true, slug: true, order: true } },
      },
      orderBy: [
        { isSignature: "desc" },
        { isBestseller: "desc" },
        { category: { order: "asc" } },
        { order: "asc" },
      ],
      take: limit * 3,
    });

    // One portion per dish: "Fesenjan Large" and "Fesenjan Medium"
    // should not both appear in a four-up editorial grid.
    const seen = new Set<string>();
    const out: DishCardData[] = [];
    for (const item of items) {
      const dish = toDishCard(item, item.category);
      const key = dish.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(dish);
      if (out.length === limit) break;
    }
    return out;
  } catch (e) {
    console.error("[menu] featured dishes unavailable:", e);
    return [];
  }
}

export const getMenuItemBySlug = cache(async (slug: string) => {
  const item = await prisma.menuItem.findUnique({
    where: { slug },
    select: {
      ...DISH_SELECT,
      isActive: true,
      updatedAt: true,
      category: { select: { name: true, slug: true, isActive: true } },
      variants: {
        where: { isAvailable: true },
        orderBy: { order: "asc" },
        select: { id: true, label: true, price: true },
      },
    },
  });
  if (!item || !item.isActive || !item.category.isActive) return null;
  return {
    dish: toDishCard(item, item.category),
    variants: item.variants,
    updatedAt: item.updatedAt,
  };
});

/** Other dishes from the same category, for the dish page footer. */
export async function getRelatedDishes(
  categorySlug: string,
  excludeSlug: string,
  limit = 3,
): Promise<DishCardData[]> {
  try {
    const items = await prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        isActive: true,
        slug: { not: excludeSlug },
        category: { slug: categorySlug, isActive: true },
      },
      select: {
        ...DISH_SELECT,
        category: { select: { name: true, slug: true } },
      },
      orderBy: [{ isSignature: "desc" }, { order: "asc" }],
      take: limit,
    });
    return items.map((i) => toDishCard(i, i.category));
  } catch {
    return [];
  }
}

export async function getActiveBanner(position: string) {
  try {
    return await prisma.banner.findFirst({
      where: { isActive: true, position },
      orderBy: { order: "asc" },
    });
  } catch {
    return null;
  }
}

export async function getGalleryImages(limit?: number) {
  try {
    return await prisma.galleryImage.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        caption: true,
        imageUrl: true,
        width: true,
        height: true,
      },
    });
  } catch (e) {
    console.error("[gallery] unavailable:", e);
    return [];
  }
}
