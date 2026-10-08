import { AdminPage } from "@/components/admin/ui";
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
    <AdminPage title="Orders" className="max-w-[1600px]">
      <OrdersBoard
        initial={{ ...data, acceptingOrders: settings.acceptingOrders, serverTime: new Date().toISOString() }}
        providers={providers}
      />
    </AdminPage>
  );
}
