import { CMS_ROLES, ok, requireAuth } from "@/lib/api";
import { undoPlatformOrder } from "@/lib/ops/platform-import";
import { opsError } from "@/lib/ops/http";

/** Remove a saved platform order; its receipt goes back to "check". */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    return ok(await undoPlatformOrder(id, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
