import { NextResponse } from "next/server";
import { parseJson, serverError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getTrackingSummaries } from "@/lib/ordering/orders";
import { trackStatusesSchema } from "@/lib/ordering/schemas";

/** Status of the orders this device placed, for the "your orders" list. */
export async function POST(req: Request) {
  const limit = rateLimit(`track:${clientIp(req)}`, { limit: 120, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  const parsed = await parseJson(req, trackStatusesSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const orders = await getTrackingSummaries(parsed.data.tokens);
    return NextResponse.json(
      { orders },
      { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
    );
  } catch (e) {
    return serverError(e);
  }
}
