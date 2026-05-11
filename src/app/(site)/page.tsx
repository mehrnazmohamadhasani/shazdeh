import { HomeHero } from "@/components/home/hero";
import { HomeManifesto } from "@/components/home/manifesto";
import { FeaturedDishes } from "@/components/home/featured-dishes";
import { HomeValues } from "@/components/home/values";
import { GalleryPreview } from "@/components/home/gallery-preview";
import { HomeCta } from "@/components/home/cta";
import {
  getActiveBanner,
  getPopularDishes,
  getGalleryImages,
} from "@/lib/menu";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

export default async function HomePage() {
  const [banner, featured, gallery, settings, socials] = await Promise.all([
    getActiveBanner("home_hero"),
    getPopularDishes(["Makaroni", "Loobia Polo", "Gheimeh Bademjan", "Ghormeh Sabzi"]),
    getGalleryImages(8),
    getSettings(),
    prisma.socialLink
      .findMany({ where: { platform: "whatsapp", isActive: true } })
      .catch(() => []),
  ]);

  const whatsapp = settings.whatsapp ?? socials[0]?.url;

  return (
    <>
      <HomeHero
        imageUrl={banner?.imageUrl ?? "/menu/ghormeh-sabzi.jpg"}
        title={banner?.title}
        subtitle={
          banner?.subtitle ??
          "A contemporary Persian table set in Dubai, plated with the calm precision of an editorial kitchen."
        }
      />
      <HomeManifesto />
      <FeaturedDishes dishes={featured} whatsapp={whatsapp} />
      <HomeValues />
      <GalleryPreview
        images={gallery.map((g) => ({
          id: g.id,
          url: g.imageUrl,
          alt: g.title ?? "",
          title: g.title,
        }))}
      />
      <HomeCta imageUrl="/menu/baghali-polo-mahiche.jpg" whatsapp={whatsapp} />
    </>
  );
}
