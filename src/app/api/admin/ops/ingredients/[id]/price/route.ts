import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { setPrice } from "@/lib/ops/catalog";
import { priceSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Correct one ingredient's price; stock stays as it is. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, priceSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    await setPrice(id, parsed.data, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
