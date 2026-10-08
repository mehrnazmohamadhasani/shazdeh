import { AdminPage } from "@/components/admin/ui";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gallery" };

export default async function GalleryAdminPage() {
  const images = await prisma.galleryImage.findMany({
    orderBy: { order: "asc" },
    select: { id: true, imageUrl: true },
  });
  return (
    <AdminPage title="Gallery">
      <GalleryManager initial={images} />
    </AdminPage>
  );
}
