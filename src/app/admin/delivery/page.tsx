import { AdminPageHeader } from "@/components/admin/page-header";
import { ZonesManager } from "@/components/admin/ordering/zones-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery zones" };

export default async function DeliveryPage() {
  const zones = await prisma.deliveryZone.findMany({
    orderBy: { order: "asc" },
    include: { areas: { orderBy: { order: "asc" }, select: { name: true, lat: true, lng: true } } },
  });
  return (
    <div className="container-shazdeh space-y-10 py-10 md:py-14">
      <AdminPageHeader
        eyebrow="Ordering"
        title="Delivery zones"
        description="Where you deliver, what it costs, the minimum order and how long it takes. Customers pick their area; the zone sets the terms."
      />
      <ZonesManager zones={zones} />
    </div>
  );
}
