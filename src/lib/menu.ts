import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { toDishCard, type DishCardData } from "@/lib/dish";

export type { DishCardData } from "@/lib/dish";

export type MenuCategoryWithItems = {
  id: string;
  slug: string;
  name: string;
  order: number;
  items: DishCardData[];
};

const DISH_SELECT = {
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
        order: c.order,
        items: c.items.map((i) =>
          toDishCard(i, { name: c.name, slug: c.slug }),
        ),
      }))
      .filter((c) => c.items.length > 0);
  },
);

/**
 * Dishes for the home page: the first photographed, in-stock dishes in
 * menu order — so staff choose them simply by ordering the menu.
 */
export async function getFeaturedDishes(limit = 4): Promise<DishCardData[]> {
  try {
    const items = await prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        isActive: true,
        imageUrl: { not: null },
        category: { isActive: true },
      },
      select: {
        ...DISH_SELECT,
        category: { select: { name: true, slug: true, order: true } },
      },
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
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
    },
  });
  if (!item || !item.isActive || !item.category.isActive) return null;
  return {
    dish: toDishCard(item, item.category),
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
      orderBy: { order: "asc" },
      take: limit,
    });
    return items.map((i) => toDishCard(i, i.category));
  } catch {
    return [];
  }
}

export async function getGalleryImages(limit?: number) {
  try {
    return await prisma.galleryImage.findMany({
      orderBy: { order: "asc" },
      take: limit,
      select: {
        id: true,
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
