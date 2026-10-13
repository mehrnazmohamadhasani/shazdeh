import { CMS_ROLES, ok, requireAuth } from "@/lib/api";
import { discardDocument } from "@/lib/ops/documents";
import { opsError } from "@/lib/ops/http";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await discardDocument(id, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
