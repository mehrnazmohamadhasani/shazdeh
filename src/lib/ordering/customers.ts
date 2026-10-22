import "server-only";
import { prisma } from "@/lib/prisma";
import { mergeCustomers } from "@/lib/ordering/customer-list";

// Orders that count towards a customer's history.
const COUNTED = { status: { notIn: ["CANCELLED", "REJECTED", "PENDING_PAYMENT"] as ("CANCELLED" | "REJECTED" | "PENDING_PAYMENT")[] } };

/** Every customer we know, one row per mobile (see customer-list.ts) — for the Customers page and campaign audiences. */
export async function loadCustomerRows() {
  const [customers, stats, latest, claims, unsubscribes] = await Promise.all([
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
    prisma.marketingUnsubscribe.findMany({ select: { email: true } }),
  ]);
  const lastOrder = new Map(latest.map((o) => [o.customerPhone, o.id]));
  return mergeCustomers(
    customers,
    stats.map((s) => ({
      phone: s.customerPhone,
      orders: s._count._all,
      spentFils: s._sum.totalFils ?? 0,
      lastOrderAt: s._max.placedAt,
      lastOrderId: lastOrder.get(s.customerPhone) ?? null,
    })),
    claims.map((c) => ({ ...c, code: c.coupon.code, used: c.orderId !== null })),
    new Set(unsubscribes.map((u) => u.email)),
  );
}
