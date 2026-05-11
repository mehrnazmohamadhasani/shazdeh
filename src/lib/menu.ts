import "server-only";
import { prisma } from "@/lib/prisma";
import type { DishCardData } from "@/components/menu/dish-card";

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

export async function getMenuTree(): Promise<MenuCategoryWithItems[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    include: {
      items: {
        orderBy: { order: "asc" },
      },
    },
  });

  return categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    imageUrl: c.imageUrl,
    order: c.order,
    items: c.items.map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      nameFa: i.nameFa,
      description: i.description,
      price: i.price,
      currency: i.currency,
      imageUrl: i.imageUrl,
      spicyLevel: i.spicyLevel,
      isVegetarian: i.isVegetarian,
      isBestseller: i.isBestseller,
      isNew: i.isNew,
      isSignature: i.isSignature,
      isAvailable: i.isAvailable,
      category: { name: c.name, slug: c.slug },
    })),
  }));
}

export async function getFeaturedDishes(limit = 6): Promise<DishCardData[]> {
  const items = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      OR: [{ isSignature: true }, { isBestseller: true }],
    },
    include: { category: true },
    orderBy: [{ isSignature: "desc" }, { isBestseller: "desc" }, { order: "asc" }],
    take: limit,
  });

  return items.map((i) => ({
    id: i.id,
    slug: i.slug,
    name: i.name,
    nameFa: i.nameFa,
    description: i.description,
    price: i.price,
    currency: i.currency,
    imageUrl: i.imageUrl,
    spicyLevel: i.spicyLevel,
    isVegetarian: i.isVegetarian,
    isBestseller: i.isBestseller,
    isNew: i.isNew,
    isSignature: i.isSignature,
    isAvailable: i.isAvailable,
    category: { name: i.category.name, slug: i.category.slug },
  }));
}

export async function getPopularDishes(names: string[]): Promise<DishCardData[]> {
  const items = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      name: { in: names },
    },
    include: { category: true },
  });

  // Preserve the order the caller specified
  const ordered = names
    .map((n) => items.find((i) => i.name === n))
    .filter(Boolean) as typeof items;

  return ordered.map((i) => ({
    id: i.id,
    slug: i.slug,
    name: i.name,
    nameFa: i.nameFa,
    description: i.description,
    price: i.price,
    currency: i.currency,
    imageUrl: i.imageUrl,
    spicyLevel: i.spicyLevel,
    isVegetarian: i.isVegetarian,
    isBestseller: i.isBestseller,
    isNew: i.isNew,
    isSignature: i.isSignature,
    isAvailable: i.isAvailable,
    category: { name: i.category.name, slug: i.category.slug },
  }));
}

export async function getMenuItemBySlug(slug: string) {
  return prisma.menuItem.findUnique({
    where: { slug },
    include: { category: true, variants: { orderBy: { order: "asc" } } },
  });
}

export async function getActiveBanner(position: string) {
  return prisma.banner.findFirst({
    where: { isActive: true, position },
    orderBy: { order: "asc" },
  });
}

export async function getGalleryImages(limit?: number) {
  return prisma.galleryImage.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    take: limit,
  });
}
