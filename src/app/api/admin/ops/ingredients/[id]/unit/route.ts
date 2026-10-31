import { z } from "zod";
import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { changeIngredientUnit } from "@/lib/ops/catalog";
import { opsError } from "@/lib/ops/http";

const schema = z.object({
  /** Never into ml: stock is grams or pieces (1 L = 1 kg). */
  unit: z.enum(["G", "PCS"]),
  /** New units per old unit (g / ml / pcs): 1 pc = 18 kg → 18000. */
  factor: z.number().finite().positive().max(1_000_000),
});

/** Count an ingredient in another unit, converting what is already recorded (owner and managers: recipes change too). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return ok(await changeIngredientUnit(id, parsed.data.unit, parsed.data.factor, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
