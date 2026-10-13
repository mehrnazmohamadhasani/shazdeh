import { AdminPage } from "@/components/admin/ui";
import { SocialManager } from "@/components/admin/social-manager";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Links") };
}

export default async function SocialAdminPage() {
  const { t } = await getAdminI18n();
  const links = await prisma.socialLink.findMany({
    orderBy: { order: "asc" },
    select: { id: true, platform: true, label: true, url: true, order: true, isActive: true },
  });
  return (
    <AdminPage title={t("Links")} description={t("Instagram, WhatsApp and delivery apps shown on the website.")}>
      <SocialManager initial={links} />
    </AdminPage>
  );
}
