import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin/ui";
import { OrderingSettingsForm } from "@/components/admin/ordering/ordering-settings-form";
import { requireAdmin } from "@/lib/auth";
import { getOrderingSettings } from "@/lib/ordering/config";
import { getSettings } from "@/lib/settings";
import { getOnlineProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Online ordering" };

export default async function OrderingSettingsPage() {
  const user = await requireAdmin();
  if (user.role !== "ADMIN") redirect("/admin");
  const [s, site] = await Promise.all([getOrderingSettings(), getSettings()]);
  const provider = getOnlineProvider();
  return (
    <AdminPage title="Online ordering">
      <OrderingSettingsForm
        onlineProvider={provider ? provider.id : null}
        siteHours={site.openingHours}
        initial={{
          acceptingOrders: s.acceptingOrders,
          pausedMessage: s.pausedMessage,
          deliveryHours: s.deliveryHours,
          kitchenLat: s.kitchenLat,
          kitchenLng: s.kitchenLng,
          vatRate: s.vatRate,
          pricesIncludeVat: s.pricesIncludeVat,
          serviceFee: s.serviceFee,
          paymentMethods: s.paymentMethods,
          deliveryModel: s.deliveryModel,
          autoAccept: s.autoAccept,
          notifyEmail: s.notifyEmail,
          legalName: s.legalName,
          tradeLicenseNo: s.tradeLicenseNo,
          licensingAuthority: s.licensingAuthority,
          trn: s.trn,
        }}
      />
    </AdminPage>
  );
}
