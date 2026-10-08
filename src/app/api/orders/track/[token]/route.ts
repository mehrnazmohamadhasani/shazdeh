import { NextResponse } from "next/server";
import { notFound, serverError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getTrackingView } from "@/lib/ordering/orders";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const limit = rateLimit(`track:${clientIp(req)}`, { limit: 120, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return notFound();
  try {
    const view = await getTrackingView(token);
    if (!view) return notFound();
    return NextResponse.json(view, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  } catch (e) {
    return serverError(e);
  }
}
