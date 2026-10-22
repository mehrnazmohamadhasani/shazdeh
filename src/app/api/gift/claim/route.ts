import { z } from "zod";
import { NextResponse } from "next/server";
import { parseJson, serverError } from "@/lib/api";
import { clientIp, sharedRateLimit } from "@/lib/rate-limit";
import { normalizeMobile } from "@/lib/ordering/phone";
import { claimGift } from "@/lib/ordering/gifts";

const claimSchema = z.object({
  code: z.string().trim().min(3).max(32),
  name: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().min(6).max(32),
  email: z.email().max(160),
  marketingOptIn: z.boolean().optional().default(false),
});

/** A customer claims a QR gift: it works for their mobile right away, and is emailed to them. */
export async function POST(req: Request) {
  // Each claim sends an email: keep it to a handful per device per hour.
  const limit = await sharedRateLimit(`gift-claim:${clientIp(req)}`, { limit: 8, windowMs: 3600_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many tries — please wait a little and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const parsed = await parseJson(req, claimSchema);
  if (!parsed.ok) return parsed.response;
  const phone = normalizeMobile(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Enter a mobile number. Not a UAE number? Start with your country code, e.g. +44." }, { status: 422 });
  }
  try {
    const result = await claimGift({
      code: parsed.data.code,
      name: parsed.data.name || null,
      phone,
      email: parsed.data.email,
      marketingOptIn: parsed.data.marketingOptIn,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (e) {
    return serverError(e);
  }
}
