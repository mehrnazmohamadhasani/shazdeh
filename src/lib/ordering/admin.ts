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
  seenAt: true,
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
  const [orders, total, counts, unseen] = await Promise.all([
    prisma.order.findMany({ where, orderBy, take, skip: view === "history" ? (page - 1) * take : 0, select: LIST_SELECT }),
    view === "history" ? prisma.order.count({ where }) : Promise.resolve(0),
    prisma.order.groupBy({ by: ["status"], where: { status: { in: [...ACTIVE_STATUSES] } }, _count: true }),
    prisma.order.count({ where: UNSEEN }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return {
    orders: orders.map((o) => ({
      ...o,
      placedAt: o.placedAt.toISOString(),
      seenAt: o.seenAt?.toISOString() ?? null,
      items: o.items.map((i) => ({
        ...i,
        modifiers: ((i.modifiers as { name: string }[] | null) ?? []).map((m) => m.name),
      })),
    })),
    total,
    pages: view === "history" ? Math.max(1, Math.ceil(total / take)) : 1,
    counts: { new: countOf("RECEIVED"), unseen, active: ACTIVE_STATUSES.reduce((s, st) => s + countOf(st), 0) },
  };
}

/** Orders that keep the admin alarm ringing: new (until accepted), or auto-accepted and not yet acknowledged. */
const UNSEEN = {
  OR: [{ status: "RECEIVED" }, { status: { in: [...ACTIVE_STATUSES] }, seenAt: null }],
} satisfies Prisma.OrderWhereInput;

/** Accepted orders whose tickets haven't been printed (recent only, so an old backlog never floods the printer). */
const TO_PRINT = { status: { in: ["CONFIRMED", "PREPARING"] }, printedAt: null } satisfies Prisma.OrderWhereInput;
const PRINT_WINDOW_MS = 6 * 3600_000;

/** What the admin-wide alarm polls: cheap, no item lists. */
export async function orderAlerts() {
  const [unseen, toPrint] = await Promise.all([
    prisma.order.findMany({
      where: UNSEEN,
      orderBy: { placedAt: "desc" },
      take: 20,
      select: { id: true, number: true, customerName: true, areaName: true, totalFils: true },
    }),
    prisma.order.findMany({
      where: { ...TO_PRINT, placedAt: { gte: new Date(Date.now() - PRINT_WINDOW_MS) } },
      orderBy: { placedAt: "asc" },
      take: 10,
      select: { id: true, number: true },
    }),
  ]);
  return { unseen, toPrint };
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
