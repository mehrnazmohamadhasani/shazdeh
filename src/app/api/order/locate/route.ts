import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, serverError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { locateDelivery } from "@/lib/ordering/zones";

const locateSchema = z.object({
  lat: z.number().min(22).max(27), // UAE bounding box
  lng: z.number().min(51).max(57),
});

/** Which delivery zone a pinned location falls in — the zone only, never the distance or the kitchen. */
export async function POST(req: Request) {
  const limit = rateLimit(`locate:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const parsed = await parseJson(req, locateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const found = await locateDelivery(parsed.data.lat, parsed.data.lng);
    const body = found.ok ? { ok: true, areaId: found.area.id } : { ok: false, reason: found.reason };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
