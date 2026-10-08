import { NextResponse, type NextRequest } from "next/server";
import { refreshPayment } from "@/lib/ordering/orders";

/**
 * Where the gateway sends the customer back. We ask the gateway for the
 * payment status server-to-server (never trusting query parameters),
 * then show the tracking page, which keeps polling until it settles.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("order") ?? "";
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    return NextResponse.redirect(new URL("/order", req.nextUrl));
  }
  await refreshPayment(token);
  return NextResponse.redirect(new URL(`/order/track/${token}?placed=1`, req.nextUrl));
}
