import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/* Staff-side order queries. */

export const ACTIVE_STATUSES = ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const;
const DONE_STATUSES = ["DELIVERED", "REJECTED", "CANCELLED"] as const;

const LIST_SELECT = {
  id: true,
  number: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  placedAt: true,
  etaMin: true,
  etaMax: true,
  areaName: true,
  building: true,
  customerName: true,
  customerPhone: true,
  totalFils: true,
  notes: true,
  cutlery: true,
  items: { select: { name: true, portion: true, quantity: true, modifiers: true, notes: true } },
} satisfies Prisma.OrderSelect;

export type BoardOrder = Awaited<ReturnType<typeof listOrders>>["orders"][number];

export async function listOrders(view: "active" | "done" | "history", opts: { q?: string; page?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  let where: Prisma.OrderWhereInput;
  let orderBy: Prisma.OrderOrderByWithRelationInput = { placedAt: "desc" };
  let take = 100;
  if (view === "active") {
    where = { status: { in: [...ACTIVE_STATUSES] } };
    orderBy = { placedAt: "asc" }; // oldest first — that's the next one to cook
  } else if (view === "done") {
    where = { status: { in: [...DONE_STATUSES] }, placedAt: { gte: new Date(Date.now() - 24 * 3600_000) } };
  } else {
    take = 30;
    const q = opts.q?.trim();
    where = {
      status: { not: "PENDING_PAYMENT" },
      ...(q
        ? {
            OR: [
              { number: { contains: q.toUpperCase() } },
              { customerPhone: { contains: q.replace(/[^\d+]/g, "") || q } },
              { customerName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }
  const [orders, total, counts] = await Promise.all([
    prisma.order.findMany({ where, orderBy, take, skip: view === "history" ? (page - 1) * take : 0, select: LIST_SELECT }),
    view === "history" ? prisma.order.count({ where }) : Promise.resolve(0),
    prisma.order.groupBy({ by: ["status"], where: { status: { in: [...ACTIVE_STATUSES] } }, _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return {
    orders: orders.map((o) => ({
      ...o,
      placedAt: o.placedAt.toISOString(),
      items: o.items.map((i) => ({
        ...i,
        modifiers: ((i.modifiers as { name: string }[] | null) ?? []).map((m) => m.name),
      })),
    })),
    total,
    pages: view === "history" ? Math.max(1, Math.ceil(total / take)) : 1,
    counts: { new: countOf("RECEIVED"), active: ACTIVE_STATUSES.reduce((s, st) => s + countOf(st), 0) },
  };
}

export async function getOrderDetail(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      events: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) return null;
  const previous = await prisma.order.count({
    where: { customerPhone: order.customerPhone, id: { not: order.id }, status: { in: ["DELIVERED"] } },
  });
  return { order, previousOrders: previous };
}
