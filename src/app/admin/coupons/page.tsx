import { AdminPageHeader } from "@/components/admin/page-header";
import { CouponsManager } from "@/components/admin/ordering/coupons-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Promo codes" };

export default async function CouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="container-shazdeh space-y-10 py-10 md:py-14">
      <AdminPageHeader eyebrow="Ordering" title="Promo codes" description="Percentage, fixed-amount or free-delivery codes with limits and dates." />
      <CouponsManager
        coupons={coupons.map((c) => ({
          ...c,
          startsAt: c.startsAt?.toISOString() ?? null,
          endsAt: c.endsAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
