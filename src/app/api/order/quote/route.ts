import { NextResponse } from "next/server";
import { parseJson, serverError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { quoteSchema } from "@/lib/ordering/schemas";
import { publicQuote, quoteOrder } from "@/lib/ordering/orders";

/** Server-priced basket: lines, delivery terms, promo and totals. */
export async function POST(req: Request) {
  const limit = rateLimit(`quote:${clientIp(req)}`, { limit: 90, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const parsed = await parseJson(req, quoteSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const quote = await quoteOrder(parsed.data);
    return NextResponse.json(publicQuote(quote), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
