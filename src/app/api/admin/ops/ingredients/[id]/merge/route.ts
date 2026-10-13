import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { mergeIngredients } from "@/lib/ops/catalog";
import { mergeSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Merge a duplicate ingredient into another with the same unit. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, mergeSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    await mergeIngredients(id, parsed.data.intoId, auth.user);
    return ok({ id: parsed.data.intoId });
  } catch (e) {
    return opsError(e);
  }
}
