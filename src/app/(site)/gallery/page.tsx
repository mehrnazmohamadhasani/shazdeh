import type { Metadata } from "next";
import { PageHero } from "@/components/shared/page-hero";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { getGalleryImages } from "@/lib/menu";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "An editorial journal of saffron rice, slow-cooked khoresh and golden tahdig — photographs from the SHĀZDEH kitchen in Dubai.",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryPage() {
  const images = await getGalleryImages();

  return (
    <>
      <PageHero
        size="compact"
        eyebrow="Gallery"
        title={
          <>
            Where food becomes <span className="text-terracotta">art</span>.
          </>
        }
        description="Slow stews, saffron rice, the golden crackle of tahdig — a visual journal from inside the SHĀZDEH kitchen."
      />
      <GalleryGrid images={images} />
    </>
  );
}
