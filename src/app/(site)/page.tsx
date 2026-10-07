import type { Metadata } from "next";
import { HomeHero } from "@/components/home/hero";
import { FeaturedDishes } from "@/components/home/featured-dishes";
import { HomeManifesto } from "@/components/home/manifesto";
import { HomeCraft } from "@/components/home/craft";
import { GalleryPreview } from "@/components/home/gallery-preview";
import { OrderBand } from "@/components/home/order-band";
import { JsonLd } from "@/components/shared/json-ld";
import { getActiveBanner, getFeaturedDishes, getGalleryImages } from "@/lib/menu";
import { getSettings } from "@/lib/settings";
import { deliveryPartners, findPlatform, getSocialLinks } from "@/lib/social";
import { whatsappHref } from "@/lib/links";
import { restaurantJsonLd } from "@/lib/seo";

export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [banner, featured, gallery, settings, socials] = await Promise.all([
    getActiveBanner("home_hero"),
    getFeaturedDishes(4),
    getGalleryImages(8),
    getSettings(),
    getSocialLinks(),
  ]);

  const whatsappNumber =
    settings.whatsapp ?? findPlatform(socials, "whatsapp")?.url ?? undefined;

  return (
    <>
      <JsonLd data={restaurantJsonLd(settings, socials)} />
      <HomeHero
        title={banner?.title}
        subtitle={banner?.subtitle}
        videoSrc={settings.heroVideoUrl}
      />
      <FeaturedDishes dishes={featured} whatsapp={whatsappNumber} />
      <HomeManifesto />
      <HomeCraft />
      <GalleryPreview
        images={gallery.map((g, i) => ({
          id: g.id,
          url: g.imageUrl,
          alt: g.title ?? `A SHĀZDEH plate, photograph ${i + 1}`,
        }))}
      />
      <OrderBand
        partners={deliveryPartners(socials)}
        whatsapp={whatsappHref(
          whatsappNumber,
          "Hello SHĀZDEH — I'd like to place an order.",
        )}
      />
    </>
  );
}
