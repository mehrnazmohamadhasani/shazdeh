import { AdminPage } from "@/components/admin/ui";
import { GiftClaims } from "@/components/admin/ordering/gift-claims";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { giftStatus } from "@/lib/ordering/gift-utils";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Gift claims") };
}

/** Everyone who claimed a QR gift: who used it, who hasn't yet. */
export default async function GiftClaimsPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { t } = await getAdminI18n();
  const { code } = await searchParams;
  const [gifts, claims] = await Promise.all([
    prisma.coupon.findMany({ where: { isGift: true }, orderBy: { createdAt: "desc" }, select: { code: true, scanCount: true } }),
    prisma.giftClaim.findMany({
      where: code ? { coupon: { code } } : {},
      orderBy: { createdAt: "desc" },
      take: 2000,
      include: {
        coupon: { select: { code: true, isActive: true, endsAt: true } },
        order: { select: { id: true, number: true, totalFils: true } },
      },
    }),
  ]);
  const now = new Date();
  return (
    <AdminPage title={t("Gift claims")} description={t("Customers who scanned a QR gift card and left their details.")}>
      <GiftClaims
        gifts={gifts}
        code={code ?? null}
        claims={claims.map((c) => ({
          id: c.id,
          code: c.coupon.code,
          name: c.name,
          phone: c.phone,
          email: c.email,
          marketingOptIn: c.marketingOptIn,
          emailStatus: c.emailStatus,
          createdAt: c.createdAt.toISOString(),
          usedAt: c.usedAt?.toISOString() ?? null,
          order: c.order,
          status: giftStatus(c, c.coupon, now),
        }))}
      />
    </AdminPage>
  );
}
