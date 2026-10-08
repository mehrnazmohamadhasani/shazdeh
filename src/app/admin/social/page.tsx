import { AdminPage } from "@/components/admin/ui";
import { SocialManager } from "@/components/admin/social-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Links" };

export default async function SocialAdminPage() {
  const links = await prisma.socialLink.findMany({
    orderBy: { order: "asc" },
    select: { id: true, platform: true, label: true, url: true, order: true, isActive: true },
  });
  return (
    <AdminPage title="Links" description="Instagram, WhatsApp and delivery apps shown on the website.">
      <SocialManager initial={links} />
    </AdminPage>
  );
}
