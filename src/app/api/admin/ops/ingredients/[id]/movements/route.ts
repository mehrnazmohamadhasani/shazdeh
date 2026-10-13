import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { addMovement } from "@/lib/ops/catalog";
import { movementSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Record waste, a staff meal or an adjustment for one ingredient. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, movementSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    await addMovement(id, parsed.data, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
