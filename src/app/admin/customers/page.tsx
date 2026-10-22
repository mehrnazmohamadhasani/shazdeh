import { AdminPage } from "@/components/admin/ui";
import { CustomersList } from "@/components/admin/ordering/customers-list";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { mergeCustomers } from "@/lib/ordering/customer-list";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Customers") };
}

// Orders that count towards a customer's history.
const COUNTED = { status: { notIn: ["CANCELLED", "REJECTED", "PENDING_PAYMENT"] as ("CANCELLED" | "REJECTED" | "PENDING_PAYMENT")[] } };

/** Everyone we can reach: guests who ordered and people who claimed a QR gift, one row per mobile. */
export default async function CustomersPage() {
  const { t } = await getAdminI18n();
  const [customers, stats, latest, claims] = await Promise.all([
    prisma.customer.findMany({ select: { phone: true, name: true, email: true, marketingOptIn: true, createdAt: true } }),
    prisma.order.groupBy({ by: ["customerPhone"], where: COUNTED, _count: { _all: true }, _sum: { totalFils: true }, _max: { placedAt: true } }),
    prisma.order.findMany({
      where: COUNTED,
      distinct: ["customerPhone"],
      orderBy: [{ customerPhone: "asc" }, { placedAt: "desc" }],
      select: { id: true, customerPhone: true },
    }),
    prisma.giftClaim.findMany({
      select: { phone: true, name: true, email: true, marketingOptIn: true, orderId: true, createdAt: true, coupon: { select: { code: true } } },
    }),
  ]);
  const lastOrder = new Map(latest.map((o) => [o.customerPhone, o.id]));
  const rows = mergeCustomers(
    customers,
    stats.map((s) => ({
      phone: s.customerPhone,
      orders: s._count._all,
      spentFils: s._sum.totalFils ?? 0,
      lastOrderAt: s._max.placedAt,
      lastOrderId: lastOrder.get(s.customerPhone) ?? null,
    })),
    claims.map((c) => ({ ...c, code: c.coupon.code, used: c.orderId !== null })),
  );
  return (
    <AdminPage
      title={t("Customers")}
      description={t("Everyone who ordered from the website (or by WhatsApp and phone) and everyone who claimed a QR gift — one row per mobile.")}
    >
      <CustomersList rows={rows} />
    </AdminPage>
  );
}
