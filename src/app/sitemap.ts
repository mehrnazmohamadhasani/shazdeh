import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/menu", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/order", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/order/apps", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/legal/terms", priority: 0.2, changeFrequency: "yearly" as const },
    { path: "/legal/privacy", priority: 0.2, changeFrequency: "yearly" as const },
    { path: "/legal/refunds", priority: 0.2, changeFrequency: "yearly" as const },
    { path: "/legal/delivery", priority: 0.2, changeFrequency: "yearly" as const },
    { path: "/about", priority: 0.6, changeFrequency: "yearly" as const },
    { path: "/gallery", priority: 0.5, changeFrequency: "monthly" as const },
  ].map((r) => ({
    url: absoluteUrl(r.path),
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  try {
    const items = await prisma.menuItem.findMany({
      where: { isActive: true, category: { isActive: true } },
      select: { slug: true, updatedAt: true, imageUrl: true },
      orderBy: { order: "asc" },
    });
    const dishRoutes: MetadataRoute.Sitemap = items.map((i) => ({
      url: absoluteUrl(`/menu/${i.slug}`),
      lastModified: i.updatedAt,
      changeFrequency: "monthly",
      priority: 0.7,
      ...(i.imageUrl ? { images: [absoluteUrl(i.imageUrl)] } : {}),
    }));
    return [...staticRoutes, ...dishRoutes];
  } catch {
    return staticRoutes;
  }
}
