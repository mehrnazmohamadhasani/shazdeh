import { CMS_ROLES, ok, requireAuth } from "@/lib/api";
import { voidWithdrawal } from "@/lib/ops/cash";
import { opsError } from "@/lib/ops/http";

/** Remove a withdrawal entered by mistake (kept, marked void, for the audit trail). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await voidWithdrawal(id, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
