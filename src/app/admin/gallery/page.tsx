import { AdminPageHeader } from "@/components/admin/page-header";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gallery" };

export default async function GalleryAdminPage() {
  const images = await prisma.galleryImage.findMany({
    orderBy: { order: "asc" },
  });
  return (
    <div className="container-shazdeh py-10 md:py-14 space-y-10">
      <AdminPageHeader
        eyebrow="Visual"
        title="Gallery"
        description="The lookbook for the kitchen. Upload as many images as you like — drag the order with the sort number."
      />
      <GalleryManager initial={images} />
    </div>
  );
}
