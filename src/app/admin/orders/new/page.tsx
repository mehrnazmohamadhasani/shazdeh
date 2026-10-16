import { AdminPage } from "@/components/admin/ui";
import { NewOrderForm } from "@/components/admin/orders/new-order-form";
import { getOrderMenu } from "@/lib/ordering/catalog";
import { getDeliveryNetwork } from "@/lib/ordering/zones";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("New order") };
}

/** An order a customer sent on WhatsApp or by phone, entered by staff. */
export default async function NewOrderPage() {
  const { t } = await getAdminI18n();
  const [menu, network] = await Promise.all([getOrderMenu(), getDeliveryNetwork()]);
  return (
    <AdminPage
      title={t("New order")}
      description={t("For a customer who ordered on WhatsApp or by phone. Prices, delivery fee and promo codes work as on the website.")}
      className="max-w-3xl"
    >
      <NewOrderForm menu={menu} areas={network.areas} zones={network.zones.map((z) => ({ id: z.id, name: z.name }))} />
    </AdminPage>
  );
}
