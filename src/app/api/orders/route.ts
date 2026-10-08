import { NextResponse, type NextRequest } from "next/server";
import { parseJson, serverError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { placeOrderSchema } from "@/lib/ordering/schemas";
import { placeOrder } from "@/lib/ordering/orders";

/** Places an order. Prices, fees and discounts are recomputed server-side. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const byIp = rateLimit(`order:ip:${ip}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!byIp.ok) {
    return NextResponse.json(
      { error: "Too many orders from this connection — please try again shortly." },
      { status: 429, headers: { "Retry-After": String(byIp.retryAfterSeconds) } },
    );
  }
  const parsed = await parseJson(req, placeOrderSchema);
  if (!parsed.ok) return parsed.response;

  const byPhone = rateLimit(`order:phone:${parsed.data.customer.phone}`, { limit: 6, windowMs: 10 * 60_000 });
  if (!byPhone.ok) {
    return NextResponse.json(
      { error: "Several orders were just placed for this number — please call us if you need help." },
      { status: 429, headers: { "Retry-After": String(byPhone.retryAfterSeconds) } },
    );
  }

  // Gateways redirect back to the canonical site in production; the
  // request origin is only trusted for local development.
  const origin =
    process.env.NODE_ENV === "production"
      ? env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
      : req.nextUrl.origin;

  try {
    const result = await placeOrder(parsed.data, origin);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code, quote: result.quote },
        { status: result.status },
      );
    }
    return NextResponse.json(
      { number: result.number, trackingToken: result.trackingToken, redirectUrl: result.redirectUrl },
      { status: 201 },
    );
  } catch (e) {
    return serverError(e);
  }
}
