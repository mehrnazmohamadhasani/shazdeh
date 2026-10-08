import { type NextRequest } from "next/server";
import { ORDER_ROLES, ok, requireAuth, serverError } from "@/lib/api";
import { listOrders } from "@/lib/ordering/admin";
import { getOrderingSettings } from "@/lib/ordering/config";

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
