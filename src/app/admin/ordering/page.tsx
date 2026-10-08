import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { OrderingSettingsForm } from "@/components/admin/ordering/ordering-settings-form";
import { requireAdmin } from "@/lib/auth";
import { getOrderingSettings } from "@/lib/ordering/config";
import { getSettings } from "@/lib/settings";
import { getOnlineProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ordering settings" };

export default async function OrderingSettingsPage() {
  const user = await requireAdmin();
  if (user.role !== "ADMIN") redirect("/admin");
  const [s, site] = await Promise.all([getOrderingSettings(), getSettings()]);
  const provider = getOnlineProvider();
  return (
    <div className="container-shazdeh space-y-10 py-10 md:py-14">
      <AdminPageHeader
        eyebrow="Ordering"
        title="Ordering settings"
        description="Hours, payments, VAT, delivery model and the legal details printed on receipts."
      />
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
          prepMinutes: s.prepMinutes,
          autoAccept: s.autoAccept,
          cutleryDefault: s.cutleryDefault,
          notifyEmail: s.notifyEmail,
          legalName: s.legalName,
          tradeLicenseNo: s.tradeLicenseNo,
          licensingAuthority: s.licensingAuthority,
          trn: s.trn,
        }}
      />
    </div>
  );
}
