import { CMS_ROLES, created, parseJson, requireAuth } from "@/lib/api";
import { createRecipe } from "@/lib/ops/recipes";
import { recipeCreateSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Start a recipe for a dish (or a prep) with an empty first draft. */
export async function POST(req: Request) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, recipeCreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return created(await createRecipe(parsed.data, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
