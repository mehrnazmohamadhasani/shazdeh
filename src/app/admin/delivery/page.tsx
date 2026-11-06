import { AdminPage } from "@/components/admin/ui";
import { ZonesManager } from "@/components/admin/ordering/zones-manager";
import { prisma } from "@/lib/prisma";
import { deliversByDistance } from "@/lib/ordering/zones";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Delivery zones") };
}

export default async function DeliveryPage() {
  await requireAdmin();
  const { t } = await getAdminI18n();
  const [zones, byDistance] = await Promise.all([
    prisma.deliveryZone.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        fee: true,
        minOrder: true,
        freeDeliveryOver: true,
        etaMin: true,
        etaMax: true,
        radiusKm: true,
        isActive: true,
        order: true,
        areas: { orderBy: { name: "asc" }, select: { name: true, lat: true, lng: true } },
      },
    }),
    deliversByDistance(),
  ]);
  return (
    <AdminPage title={t("Delivery zones")} description={t("Where you deliver, the fee, the minimum order and how long it takes.")}>
      <ZonesManager zones={zones} byDistance={byDistance} />
    </AdminPage>
  );
}
