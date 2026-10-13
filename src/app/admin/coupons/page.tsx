import { AdminPage } from "@/components/admin/ui";
import { CouponsManager } from "@/components/admin/ordering/coupons-manager";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Promo codes") };
}

export default async function CouponsPage() {
  const { t } = await getAdminI18n();
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <AdminPage title={t("Promo codes")}>
      <CouponsManager
        coupons={coupons.map((c) => ({
          ...c,
          startsAt: c.startsAt?.toISOString() ?? null,
          endsAt: c.endsAt?.toISOString() ?? null,
        }))}
      />
    </AdminPage>
  );
}
