import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand Settings" };

export default async function SettingsAdminPage() {
  const settings = await prisma.restaurantSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", brandName: "Shazdeh" },
  });

  return (
    <div className="container-shazdeh py-10 md:py-14 space-y-10">
      <AdminPageHeader
        eyebrow="Brand"
        title="Settings"
        description="The single source of truth for everything brand-level — name, contact, hours, SEO, and the logo."
      />
      <SettingsForm
        initial={{
          brandName: settings.brandName,
          tagline: settings.tagline ?? "",
          description: settings.description ?? "",
          email: settings.email ?? "",
          phone: settings.phone ?? "",
          whatsapp: settings.whatsapp ?? "",
          address: settings.address ?? "",
          mapUrl: settings.mapUrl ?? "",
          openingHours: settings.openingHours ?? "",
          logoUrl: settings.logoUrl,
          ogImageUrl: settings.ogImageUrl,
          metaTitle: settings.metaTitle ?? "",
          metaDesc: settings.metaDesc ?? "",
        }}
      />
    </div>
  );
}
