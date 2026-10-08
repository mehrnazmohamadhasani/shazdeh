import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { abandonPendingOrder } from "@/lib/ordering/orders";

/** Customer came back from the gateway via "cancel". Only affects unpaid, pending orders. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const limit = rateLimit(`abandon:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return NextResponse.json({ ok: true });
  try {
    await abandonPendingOrder(token);
  } catch (e) {
    console.error("[orders] abandon failed", e);
  }
  return NextResponse.json({ ok: true });
}
