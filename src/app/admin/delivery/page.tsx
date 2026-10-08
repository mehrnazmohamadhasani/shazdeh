import { AdminPage } from "@/components/admin/ui";
import { ZonesManager } from "@/components/admin/ordering/zones-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery zones" };

export default async function DeliveryPage() {
  const zones = await prisma.deliveryZone.findMany({
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
  });
  return (
    <AdminPage title="Delivery zones" description="Where you deliver, the fee, the minimum order and how long it takes.">
      <ZonesManager zones={zones} />
    </AdminPage>
  );
}
