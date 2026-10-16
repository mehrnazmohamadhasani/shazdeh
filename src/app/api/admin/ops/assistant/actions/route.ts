import { PURCHASING_ROLES, ok, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { recentActions } from "@/lib/ops/assistant/actions";

/** This person's latest assistant changes, for the "recent" list and undo. */
export async function GET() {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  try {
    return ok({ actions: await recentActions(auth.user) });
  } catch (e) {
    return opsError(e);
  }
}
