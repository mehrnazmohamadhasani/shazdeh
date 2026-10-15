import { CMS_ROLES, ok, requireAuth } from "@/lib/api";
import { editInvoice } from "@/lib/ops/documents";
import { opsError } from "@/lib/ops/http";

/** Reopen a saved invoice on the review screen with its saved values, to correct and save again. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    return ok(await editInvoice(id, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
