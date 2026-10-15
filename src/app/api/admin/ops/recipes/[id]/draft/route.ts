import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { discardDraft, saveDraft } from "@/lib/ops/recipes";
import { recipeDraftSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Save the draft (starts a new one when only the approved version exists). */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, recipeDraftSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return ok(await saveDraft(id, parsed.data, auth.user));
  } catch (e) {
    return opsError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await discardDraft(id, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
