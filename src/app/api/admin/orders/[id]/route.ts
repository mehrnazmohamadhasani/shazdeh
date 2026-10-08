import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ORDER_ROLES, notFound, ok, parseJson, requireAuth, serverError } from "@/lib/api";
import { orderActionSchema } from "@/lib/ordering/admin-schemas";
import { getOrderDetail } from "@/lib/ordering/admin";
import { transitionOrder } from "@/lib/ordering/orders";
import { getDeliveryProvider } from "@/lib/delivery";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(ORDER_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    const detail = await getOrderDetail(id);
    return detail ? ok(detail, { headers: { "Cache-Control": "no-store" } }) : notFound();
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(ORDER_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, orderActionSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  const actor = auth.user.email;
  const body = parsed.data;

  try {
    if (body.action === "status") {
      let dispatch;
      if (body.to === "OUT_FOR_DELIVERY") {
        const provider = getDeliveryProvider(body.dispatch?.provider ?? "own_fleet");
        if (!provider) return NextResponse.json({ error: "Unknown delivery method" }, { status: 422 });
        dispatch = await provider.dispatch(body.dispatch ?? {});
      }
      const result = await transitionOrder(id, body.to, actor, { reason: body.reason, dispatch });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return ok({ ok: true });
    }

    const order = await prisma.order.findUnique({ where: { id }, select: { id: true, paymentStatus: true, etaMin: true, etaMax: true } });
    if (!order) return notFound();

    if (body.action === "note") {
      await prisma.orderEvent.create({ data: { orderId: id, type: "note", message: body.message, actor } });
    } else if (body.action === "delay") {
      await prisma.$transaction([
        prisma.order.update({
          where: { id },
          data: { etaMin: { increment: body.minutes }, etaMax: { increment: body.minutes } },
        }),
        prisma.orderEvent.create({ data: { orderId: id, type: "note", message: `Delivery estimate pushed back ${body.minutes} min`, actor } }),
      ]);
    } else if (body.action === "markPaid") {
      if (order.paymentStatus !== "PAY_ON_DELIVERY") {
        return NextResponse.json({ error: "Only pay-on-delivery orders can be marked paid by hand." }, { status: 409 });
      }
      await prisma.$transaction([
        prisma.order.update({ where: { id }, data: { paymentStatus: "PAID" } }),
        prisma.payment.updateMany({ where: { orderId: id, status: "PAY_ON_DELIVERY" }, data: { status: "PAID" } }),
        prisma.orderEvent.create({ data: { orderId: id, type: "payment", message: "Payment collected on delivery", actor } }),
      ]);
    }
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
