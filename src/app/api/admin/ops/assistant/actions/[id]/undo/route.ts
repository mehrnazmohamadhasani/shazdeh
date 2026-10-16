import { PURCHASING_ROLES, ok, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { undoAction } from "@/lib/ops/assistant/actions";

/** Take back an applied change (within a day): opposite stock entries, the previous recipe version, the old invoice. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    return ok({ action: await undoAction(id, auth.user) });
  } catch (e) {
    return opsError(e);
  }
}
