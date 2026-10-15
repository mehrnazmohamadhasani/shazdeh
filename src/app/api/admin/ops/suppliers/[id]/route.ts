import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { updateSupplier } from "@/lib/ops/catalog";
import { supplierUpdateSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, supplierUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    await updateSupplier(id, parsed.data, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
