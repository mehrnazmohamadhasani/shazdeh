import { ok, requireAuth } from "@/lib/api";
import { approveDraft } from "@/lib/ops/recipes";
import { opsError } from "@/lib/ops/http";

/** Make the draft the kitchen standard. Admins only (brief §6.4: approval is the owner's call). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    return ok(await approveDraft(id, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
