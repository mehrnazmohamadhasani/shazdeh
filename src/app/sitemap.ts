import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/menu",
    "/about",
    "/gallery",
    "/contact",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.8,
  }));

  try {
    const items = await prisma.menuItem.findMany({
      where: { isAvailable: true },
      select: { slug: true, updatedAt: true, category: { select: { slug: true } } },
    });
    const itemRoutes: MetadataRoute.Sitemap = items.map((i) => ({
      url: `${base}/menu#${i.slug}`,
      lastModified: i.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }));
    return [...staticRoutes, ...itemRoutes];
  } catch {
    return staticRoutes;
  }
}
