import { NextResponse, type NextRequest } from "next/server";
import { ORDER_ROLES, ok, parseJson, requireAuth, serverError } from "@/lib/api";
import { listOrders } from "@/lib/ordering/admin";
import { getOrderingSettings } from "@/lib/ordering/config";
import { placeStaffOrder } from "@/lib/ordering/orders";
import { staffOrderSchema } from "@/lib/ordering/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(ORDER_ROLES);
  if (auth.response) return auth.response;
  const sp = req.nextUrl.searchParams;
  const view = sp.get("view");
  try {
    const [data, settings] = await Promise.all([
      listOrders(view === "done" || view === "history" ? view : "active", {
        q: sp.get("q")?.slice(0, 60) ?? undefined,
        page: Number(sp.get("page")) || 1,
      }),
      getOrderingSettings(),
    ]);
    return ok(
      { ...data, acceptingOrders: settings.acceptingOrders, serverTime: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return serverError(e);
  }
}

/** Staff enter an order a customer sent on WhatsApp or by phone. Priced on the server like any order. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(ORDER_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, staffOrderSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await placeStaffOrder(parsed.data, auth.user);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code, quote: result.quote }, { status: result.status });
    return NextResponse.json({ number: result.number, trackingToken: result.trackingToken }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
