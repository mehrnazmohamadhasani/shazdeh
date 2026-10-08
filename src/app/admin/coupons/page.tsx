import { AdminPage } from "@/components/admin/ui";
import { CouponsManager } from "@/components/admin/ordering/coupons-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Promo codes" };

export default async function CouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <AdminPage title="Promo codes">
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
