import { AdminPage } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings-form";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Business details") };
}

export default async function SettingsAdminPage() {
  const { t } = await getAdminI18n();
  const settings = await prisma.restaurantSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", brandName: "Shazdeh" },
  });

  return (
    <AdminPage title={t("Business details")}>
      <SettingsForm
        initial={{
          brandName: settings.brandName,
          description: settings.description ?? "",
          email: settings.email ?? "",
          phone: settings.phone ?? "",
          whatsapp: settings.whatsapp ?? "",
          address: settings.address ?? "",
          openingHours: settings.openingHours ?? "",
          logoUrl: settings.logoUrl,
          ogImageUrl: settings.ogImageUrl,
          metaTitle: settings.metaTitle ?? "",
          metaDesc: settings.metaDesc ?? "",
        }}
      />
    </AdminPage>
  );
}
