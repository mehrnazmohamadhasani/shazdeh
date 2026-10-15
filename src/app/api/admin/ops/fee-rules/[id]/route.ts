import { ok, requireAuth } from "@/lib/api";
import { deleteFeeRule } from "@/lib/ops/sales";
import { opsError } from "@/lib/ops/http";

/** Delete fee terms entered by mistake. Admins only. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await deleteFeeRule(id, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
