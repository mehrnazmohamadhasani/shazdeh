import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DELIVERY_PLATFORMS, isDeliveryPlatform, isSafeHref } from "@/lib/links";

export type SocialLinkView = {
  id: string;
  platform: string;
  label: string;
  url: string;
};

/** Active social / delivery links, deduped per request. */
export const getSocialLinks = cache(async (): Promise<SocialLinkView[]> => {
  try {
    const rows = await prisma.socialLink.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, platform: true, label: true, url: true },
    });
    return rows
      .filter((r) => isSafeHref(r.url))
      .map((r) => ({ ...r, platform: r.platform.toLowerCase() }));
  } catch (e) {
    console.error("[social] failed to load links:", e);
    return [];
  }
});

export function deliveryPartners(links: SocialLinkView[]) {
  return links
    .filter((l) => isDeliveryPlatform(l.platform))
    .sort(
      (a, b) =>
        DELIVERY_PLATFORMS.indexOf(
          a.platform as (typeof DELIVERY_PLATFORMS)[number],
        ) -
        DELIVERY_PLATFORMS.indexOf(
          b.platform as (typeof DELIVERY_PLATFORMS)[number],
        ),
    );
}

export function findPlatform(links: SocialLinkView[], platform: string) {
  return links.find((l) => l.platform === platform);
}
