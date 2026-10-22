import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { countGiftScan } from "@/lib/ordering/gifts";

/**
 * The link inside the printed gift QR. Counts the scan (once per device
 * per half hour, so re-opening doesn't inflate it) and opens the gift page.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = (await ctx.params).code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return NextResponse.redirect(new URL("/order", req.url));
  if (rateLimit(`gift-scan:${clientIp(req)}:${code}`, { limit: 1, windowMs: 30 * 60_000 }).ok) {
    await countGiftScan(code);
  }
  return NextResponse.redirect(new URL(`/gift/${code}`, req.url));
}
