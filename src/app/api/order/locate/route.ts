import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, serverError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { locateDelivery } from "@/lib/ordering/zones";
import { reverseGeocode } from "@/lib/ordering/reverse-geocode";

const locateSchema = z.object({
  lat: z.number().min(22).max(27), // UAE bounding box
  lng: z.number().min(51).max(57),
});

/**
 * Which delivery zone a pinned location falls in — the zone only, never
 * the distance or the kitchen — and the pin's address in words.
 */
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
    const { lat, lng } = parsed.data;
    const [found, place] = await Promise.all([locateDelivery(lat, lng), reverseGeocode(lat, lng)]);
    const body = found.ok
      ? { ok: true, areaId: found.area.id, place: place?.label ?? null, street: place?.street ?? null }
      : { ok: false, reason: found.reason };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
