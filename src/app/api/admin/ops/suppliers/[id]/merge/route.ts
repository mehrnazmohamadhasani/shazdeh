import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { mergeSuppliers } from "@/lib/ops/catalog";
import { mergeSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Merge this supplier into another (e.g. "Unknown (handwritten veg)" → the real one). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, mergeSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return ok(await mergeSuppliers(id, parsed.data.intoId, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
