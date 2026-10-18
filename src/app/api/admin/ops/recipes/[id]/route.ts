import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { deleteRecipe, updateRecipeDetails } from "@/lib/ops/recipes";
import { recipeDetailsSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, recipeDetailsSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    await updateRecipeDetails(id, parsed.data, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}

/** Delete a recipe. A draft-only one: any editor; an approved one: the owner (same rule as approving). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await deleteRecipe(id, auth.user, "manual", { allowApproved: auth.user.role === "ADMIN" });
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
