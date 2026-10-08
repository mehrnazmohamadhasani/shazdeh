import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/admin/orders/order-detail";
import { getOrderDetail } from "@/lib/ordering/admin";
import { getOrderingSettings } from "@/lib/ordering/config";
import { providersForModel } from "@/lib/delivery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, settings] = await Promise.all([getOrderDetail(id), getOrderingSettings()]);
  if (!detail) notFound();
  const { order, previousOrders } = detail;
  const providers = providersForModel(settings.deliveryModel).map(({ id, label, description }) => ({ id, label, description }));
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-10">
      <OrderDetail
        providers={providers}
        order={{
          ...order,
          placedAt: order.placedAt.toISOString(),
          seenAt: order.seenAt?.toISOString() ?? null,
          items: order.items.map((i) => ({
            id: i.id,
            name: i.name,
            portion: i.portion,
            quantity: i.quantity,
            lineTotalFils: i.lineTotalFils,
            notes: i.notes,
            modifiers: ((i.modifiers as { name: string }[] | null) ?? []).map((m) => m.name),
          })),
          events: order.events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
          previousOrders,
        }}
      />
    </div>
  );
}
