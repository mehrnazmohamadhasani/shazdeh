import { AdminPage } from "@/components/admin/ui";
import { CouponsManager } from "@/components/admin/ordering/coupons-manager";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { absoluteUrl } from "@/lib/seo";
import { giftScanPath } from "@/lib/ordering/gift-utils";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Promo codes") };
}

export default async function CouponsPage() {
  const { t } = await getAdminI18n();
  const [coupons, used] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { claims: true } } } }),
    prisma.giftClaim.groupBy({ by: ["couponId"], where: { orderId: { not: null } }, _count: { _all: true } }),
  ]);
  const usedBy = new Map(used.map((u) => [u.couponId, u._count._all]));
  return (
    <AdminPage title={t("Promo codes")}>
      <CouponsManager
        coupons={coupons.map(({ _count, ...c }) => ({
          ...c,
          claimCount: _count.claims,
          giftUsedCount: usedBy.get(c.id) ?? 0,
          scanUrl: absoluteUrl(giftScanPath(c.code)),
          startsAt: c.startsAt?.toISOString() ?? null,
          endsAt: c.endsAt?.toISOString() ?? null,
        }))}
      />
    </AdminPage>
  );
}
