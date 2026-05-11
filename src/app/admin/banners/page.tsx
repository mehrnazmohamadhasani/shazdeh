import { AdminPageHeader } from "@/components/admin/page-header";
import { BannersManager } from "@/components/admin/banners-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Banners" };

export default async function BannersAdminPage() {
  const banners = await prisma.banner.findMany({
    orderBy: [{ position: "asc" }, { order: "asc" }],
  });
  return (
    <div className="container-shazdeh py-10 md:py-14 space-y-10">
      <AdminPageHeader
        eyebrow="Storytelling"
        title="Homepage banners"
        description="The cinematic moments that anchor every page. Pick a position, drop a great image, write something quiet."
      />
      <BannersManager initial={banners} />
    </div>
  );
}
