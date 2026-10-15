import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { saveRecipeImport } from "@/lib/ops/recipe-import";
import { recipeImportSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Save a checked recipe photo as a draft of a dish or prep. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, recipeImportSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return ok(await saveRecipeImport(id, parsed.data, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
