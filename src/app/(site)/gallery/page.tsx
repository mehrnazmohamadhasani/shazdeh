import type { Metadata } from "next";
import { PageHero } from "@/components/shared/page-hero";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { getGalleryImages } from "@/lib/menu";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "An editorial visual journal of saffron rice, slow stews and the Persian table — by SHĀZDEH.",
};

export default async function GalleryPage() {
  const images = await getGalleryImages();

  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title={
          <>
            Where food
            <br />
            <span className="text-terracotta">becomes art</span>.
          </>
        }
        description="Slow stews, saffron rice, the gold crackle of fresh tahdig — an editorial journal from inside the SHĀZDEH kitchen."
      />
      <GalleryGrid images={images} />
    </>
  );
}
