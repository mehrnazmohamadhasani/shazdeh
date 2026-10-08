import { NextResponse, type NextRequest } from "next/server";
import { ok, parseJson, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { pushSubscriptionSchema } from "@/lib/ordering/admin-schemas";

/** "Notify me": push every status change of this order to this browser. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const limit = rateLimit(`push:ip:${clientIp(req)}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const { token } = await ctx.params;
  const parsed = await parseJson(req, pushSubscriptionSchema);
  if (!parsed.ok) return parsed.response;
  const { endpoint, keys } = parsed.data;
  try {
    const order = await prisma.order.findUnique({ where: { trackingToken: token }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    // One browser follows its latest order; never take over a staff device.
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
    if (existing?.userId) return ok({ ok: true });
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, orderId: order.id },
      update: { p256dh: keys.p256dh, auth: keys.auth, orderId: order.id },
    });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
