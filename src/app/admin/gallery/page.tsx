import { AdminPage } from "@/components/admin/ui";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Gallery") };
}

export default async function GalleryAdminPage() {
  const { t } = await getAdminI18n();
  const images = await prisma.galleryImage.findMany({
    orderBy: { order: "asc" },
    select: { id: true, imageUrl: true },
  });
  return (
    <AdminPage title={t("Gallery")}>
      <GalleryManager initial={images} />
    </AdminPage>
  );
}
