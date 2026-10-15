import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Plus } from "lucide-react";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { localClock } from "@/lib/ordering/hours";
import { KITCHEN_TIMEZONE } from "@/lib/ordering/config";
import { STAFF_LABEL } from "@/lib/ordering/status";
import { ACTIVE_STATUSES } from "@/lib/ordering/admin";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { UploadButton } from "@/components/admin/ops/upload-button";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Dashboard") };
}

/** Start of "today" in Dubai, as a UTC Date. */
function startOfDubaiDay(now = new Date()) {
  const { minutes } = localClock(now, KITCHEN_TIMEZONE);
  const d = new Date(now.getTime() - minutes * 60_000);
  d.setUTCSeconds(0, 0);
  return d;
}

export default async function Dashboard() {
  const { t, money, price } = await getAdminI18n();
  const [today, waiting, inProgress, soldOut, latestOrders, recentDishes, kitchen] = await Promise.all([
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
    kitchenSummary(),
  ]);

  const stats = [
    { label: t("Orders today"), value: String(today._count), href: "/admin/orders" },
    { label: t("Sales today"), value: money(today._sum.totalFils ?? 0), href: "/admin/orders" },
    { label: t("Waiting to accept"), value: String(waiting), href: "/admin/orders", alert: waiting > 0 },
    { label: t("Sold out dishes"), value: String(soldOut), href: "/admin/menu-items", alert: soldOut > 0 },
  ];

  return (
    <AdminPage
      title={t("Dashboard")}
      actions={
        <Button asChild size="sm">
          <Link href="/admin/menu-items/new">
            <Plus className="h-4 w-4" /> {t("New dish")}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title={t("Latest orders")}
          description={inProgress > 0 ? t("{n} in progress", { n: inProgress }) : undefined}
          actions={
            <Link href="/admin/orders" className="inline-flex items-center gap-1 text-[13px] font-medium text-terracotta-ink hover:underline">
              {t("Open board")} <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
            </Link>
          }
          bodyClassName="p-0 md:p-0"
        >
          {latestOrders.length === 0 ? (
            <EmptyState title={t("No orders yet")} description={t("Orders placed on the website appear here.")} />
          ) : (
            <ul className="divide-y divide-black-iron/[0.06]">
              {latestOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-black-iron/[0.02] md:px-6">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold tabular-nums">{o.number}</span>
                      <span dir="auto" className="block truncate text-[12.5px] text-dark-grey">
                        {o.customerName} · {o.areaName}
                      </span>
                    </span>
                    <StatusPill tone={o.status === "RECEIVED" ? "accent" : o.status === "DELIVERED" ? "good" : "neutral"}>
                      {t(STAFF_LABEL[o.status])}
                    </StatusPill>
                    <span className="w-24 text-end text-[13.5px] tabular-nums">{money(o.totalFils)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={t("Recently edited dishes")}
          actions={
            <Link href="/admin/menu-items" className="inline-flex items-center gap-1 text-[13px] font-medium text-terracotta-ink hover:underline">
              {t("All dishes")} <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
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
                    <span dir="auto" className="block truncate text-[14px] font-medium">{d.name}</span>
                    <span dir="auto" className="block truncate text-[12.5px] text-dark-grey">{d.category.name}</span>
                  </span>
                  {!d.isActive ? (
                    <StatusPill>{t("Hidden")}</StatusPill>
                  ) : !d.isAvailable ? (
                    <StatusPill tone="warn">{t("Sold out")}</StatusPill>
                  ) : null}
                  <span className="text-[13.5px] tabular-nums">{price(d.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title={t("Kitchen")}
        actions={
          <span className="flex flex-wrap justify-end gap-2">
            <UploadButton kind="recipe" label={t("Recipe photo")} variant="outline" />
            <UploadButton label={t("Add invoice")} />
          </span>
        }
        bodyClassName="p-0 md:p-0"
      >
        <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
          {[
            {
              href: "/admin/ops/invoices",
              label: t("Invoices to check"),
              value: String(kitchen.invoicesToCheck),
              alert: kitchen.invoicesToCheck > 0,
            },
            {
              href: "/admin/ops/recipes",
              label: t("Recipe photos to check"),
              value: String(kitchen.recipePhotosToCheck),
              alert: kitchen.recipePhotosToCheck > 0,
            },
            {
              href: "/admin/ops/payables",
              label: t("Owed to suppliers"),
              value: money(kitchen.owedFils),
              note: kitchen.overdue > 0 ? t("{n} overdue", { n: kitchen.overdue }) : null,
              alert: kitchen.overdue > 0,
            },
            {
              href: "/admin/ops/recipes",
              label: t("Dishes with an approved recipe"),
              value: t("{done} of {total}", { done: kitchen.approvedDishes, total: kitchen.activeDishes }),
            },
          ].map((row) => (
            <li key={row.label}>
              <Link href={row.href} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-black-iron/[0.02] md:px-6">
                <span className="min-w-0 flex-1">{row.label}</span>
                {row.note && <StatusPill tone="bad">{row.note}</StatusPill>}
                <span className={`font-semibold tabular-nums ${row.alert ? "text-terracotta-ink" : ""}`}>{row.value}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </AdminPage>
  );
}

/** What needs doing in the kitchen: documents to check, money owed, recipe progress. */
async function kitchenSummary() {
  const [invoicesToCheck, recipePhotosToCheck, owed, overdue, approvedDishes, activeDishes] = await Promise.all([
    prisma.opsDocument.count({ where: { kind: { not: "recipe" }, status: { in: ["NEEDS_REVIEW", "FAILED"] } } }),
    prisma.opsDocument.count({ where: { kind: "recipe", status: { in: ["NEEDS_REVIEW", "FAILED"] } } }),
    prisma.purchaseInvoice.aggregate({ where: { voidedAt: null, paidAt: null, paymentMode: "credit" }, _sum: { totalFils: true } }),
    prisma.purchaseInvoice.count({ where: { voidedAt: null, paidAt: null, paymentMode: "credit", dueDate: { lt: new Date() } } }),
    prisma.recipe.count({ where: { kind: "DISH", menuItem: { isActive: true }, versions: { some: { status: "APPROVED" } } } }),
    prisma.menuItem.count({ where: { isActive: true } }),
  ]);
  return { invoicesToCheck, recipePhotosToCheck, owedFils: owed._sum.totalFils ?? 0, overdue, approvedDishes, activeDishes };
}
