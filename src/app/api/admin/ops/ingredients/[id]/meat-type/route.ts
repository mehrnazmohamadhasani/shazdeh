import { z } from "zod";
import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { setIngredientMeatType } from "@/lib/ops/meat";
import { opsError } from "@/lib/ops/http";

const schema = z.object({ meatTypeId: z.string().min(1).nullable() });

/** Mark an ingredient as raw meat of a kind (or not meat). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    await setIngredientMeatType(id, parsed.data.meatTypeId, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
