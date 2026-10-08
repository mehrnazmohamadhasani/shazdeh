import { AdminPage } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business details" };

export default async function SettingsAdminPage() {
  const settings = await prisma.restaurantSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", brandName: "Shazdeh" },
  });

  return (
    <AdminPage title="Business details">
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
