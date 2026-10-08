import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Plus } from "lucide-react";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { formatFils } from "@/lib/ordering/money";
import { localClock } from "@/lib/ordering/hours";
import { KITCHEN_TIMEZONE } from "@/lib/ordering/config";
import { STAFF_LABEL } from "@/lib/ordering/status";
import { ACTIVE_STATUSES } from "@/lib/ordering/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

/** Start of "today" in Dubai, as a UTC Date. */
function startOfDubaiDay(now = new Date()) {
  const { minutes } = localClock(now, KITCHEN_TIMEZONE);
  const d = new Date(now.getTime() - minutes * 60_000);
  d.setUTCSeconds(0, 0);
  return d;
}

export default async function Dashboard() {
  const [today, waiting, inProgress, soldOut, latestOrders, recentDishes] = await Promise.all([
    prisma.order.aggregate({
      where: {
        placedAt: { gte: startOfDubaiDay() },
        status: { notIn: ["PENDING_PAYMENT", "REJECTED", "CANCELLED"] },
      },
      _count: true,
      _sum: { totalFils: true },
    }),
    prisma.order.count({ where: { status: "RECEIVED" } }),
    prisma.order.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.menuItem.count({ where: { isAvailable: false, isActive: true } }),
    prisma.order.findMany({
      where: { status: { not: "PENDING_PAYMENT" } },
      orderBy: { placedAt: "desc" },
      take: 5,
      select: { id: true, number: true, status: true, customerName: true, areaName: true, totalFils: true },
    }),
    prisma.menuItem.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        isAvailable: true,
        isActive: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const stats = [
    { label: "Orders today", value: String(today._count), href: "/admin/orders" },
    { label: "Sales today", value: formatFils(today._sum.totalFils ?? 0), href: "/admin/orders" },
    { label: "Waiting to accept", value: String(waiting), href: "/admin/orders", alert: waiting > 0 },
    { label: "Sold out dishes", value: String(soldOut), href: "/admin/menu-items", alert: soldOut > 0 },
  ];

  return (
    <AdminPage
      title="Dashboard"
      actions={
        <Button asChild size="sm">
          <Link href="/admin/menu-items/new">
            <Plus className="h-4 w-4" /> New dish
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-[16px] border border-black-iron/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:border-black-iron/20"
          >
            <p className="text-[13px] text-dark-grey">{s.label}</p>
            <p className={`mt-2 text-[26px] font-bold tabular-nums tracking-[-0.02em] ${s.alert ? "text-terracotta-ink" : "text-black-iron"}`}>
              {s.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Latest orders"
          description={inProgress > 0 ? `${inProgress} in progress` : undefined}
          actions={
            <Link href="/admin/orders" className="inline-flex items-center gap-1 text-[13px] font-medium text-terracotta-ink hover:underline">
              Open board <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
          bodyClassName="p-0 md:p-0"
        >
          {latestOrders.length === 0 ? (
            <EmptyState title="No orders yet" description="Orders placed on the website appear here." />
          ) : (
            <ul className="divide-y divide-black-iron/[0.06]">
              {latestOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-black-iron/[0.02] md:px-6">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold tabular-nums">{o.number}</span>
                      <span className="block truncate text-[12.5px] text-dark-grey">
                        {o.customerName} · {o.areaName}
                      </span>
                    </span>
                    <StatusPill tone={o.status === "RECEIVED" ? "accent" : o.status === "DELIVERED" ? "good" : "neutral"}>
                      {STAFF_LABEL[o.status]}
                    </StatusPill>
                    <span className="w-20 text-right text-[13.5px] tabular-nums">{formatFils(o.totalFils)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recently edited dishes"
          actions={
            <Link href="/admin/menu-items" className="inline-flex items-center gap-1 text-[13px] font-medium text-terracotta-ink hover:underline">
              All dishes <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
          bodyClassName="p-0 md:p-0"
        >
          <ul className="divide-y divide-black-iron/[0.06]">
            {recentDishes.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/menu-items/${d.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-black-iron/[0.02] md:px-6">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-cream">
                    {d.imageUrl && <Image src={d.imageUrl} alt="" fill sizes="44px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{d.name}</span>
                    <span className="block truncate text-[12.5px] text-dark-grey">{d.category.name}</span>
                  </span>
                  {!d.isActive ? (
                    <StatusPill>Hidden</StatusPill>
                  ) : !d.isAvailable ? (
                    <StatusPill tone="warn">Sold out</StatusPill>
                  ) : null}
                  <span className="text-[13.5px] tabular-nums">{formatPrice(d.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AdminPage>
  );
}
