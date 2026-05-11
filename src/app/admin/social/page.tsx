import { AdminPageHeader } from "@/components/admin/page-header";
import { SocialManager } from "@/components/admin/social-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social Links" };

export default async function SocialAdminPage() {
  const links = await prisma.socialLink.findMany({
    orderBy: { order: "asc" },
  });
  return (
    <div className="container-shazdeh py-10 md:py-14 space-y-10">
      <AdminPageHeader
        eyebrow="Off the table"
        title="Social & delivery links"
        description="Where the brand lives outside the website — Instagram, WhatsApp, delivery partners."
      />
      <SocialManager initial={links} />
    </div>
  );
}
