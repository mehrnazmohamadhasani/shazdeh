import { AdminPageHeader } from "@/components/admin/page-header";
import { OrdersBoard } from "@/components/admin/orders/orders-board";
import { listOrders } from "@/lib/ordering/admin";
import { getOrderingSettings } from "@/lib/ordering/config";
import { providersForModel } from "@/lib/delivery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const [data, settings] = await Promise.all([listOrders("active"), getOrderingSettings()]);
  const providers = providersForModel(settings.deliveryModel).map(({ id, label, description }) => ({ id, label, description }));
  return (
    <div className="container-shazdeh space-y-8 py-10 md:py-14">
      <AdminPageHeader
        eyebrow="Kitchen"
        title="Orders"
        description="New orders appear here automatically. Accept, cook, dispatch — one tap per step."
      />
      <OrdersBoard
        initial={{ ...data, acceptingOrders: settings.acceptingOrders, serverTime: new Date().toISOString() }}
        providers={providers}
      />
    </div>
  );
}
