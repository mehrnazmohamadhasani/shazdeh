import { ORDER_ROLES, ok, requireAuth, serverError } from "@/lib/api";
import { orderAlerts } from "@/lib/ordering/admin";

/** Polled by the admin-wide alarm on every admin page. */
export async function GET() {
  const auth = await requireAuth(ORDER_ROLES);
  if (auth.response) return auth.response;
  try {
    return ok(await orderAlerts(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
