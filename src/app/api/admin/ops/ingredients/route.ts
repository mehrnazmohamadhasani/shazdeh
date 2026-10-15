import { CMS_ROLES, created, parseJson, requireAuth } from "@/lib/api";
import { createIngredient } from "@/lib/ops/catalog";
import { ingredientCreateSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Add an ingredient before it is ever bought (e.g. while writing a recipe). */
export async function POST(req: Request) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, ingredientCreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return created(await createIngredient(parsed.data, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
