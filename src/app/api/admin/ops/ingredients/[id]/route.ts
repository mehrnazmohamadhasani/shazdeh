import { CMS_ROLES, PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { deleteIngredient, updateIngredient } from "@/lib/ops/catalog";
import { ingredientUpdateSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, ingredientUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    await updateIngredient(id, parsed.data, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}

/** Delete an ingredient nothing uses (same roles as merging). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await deleteIngredient(id, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
