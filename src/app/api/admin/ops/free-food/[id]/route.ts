import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { editFreeFood, voidFreeFood } from "@/lib/ops/free-food";
import { freeFoodSchema } from "@/lib/ops/free-food-shared";

/** Edit: the old record is deleted (stock back) and the corrected one recorded in its place. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, freeFoodSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return ok(await editFreeFood(id, parsed.data, auth.user));
  } catch (e) {
    return opsError(e);
  }
}

/** Delete: its stock comes back; the record stays in the history, off the list. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await voidFreeFood(id, auth.user);
    return ok({ deleted: true });
  } catch (e) {
    return opsError(e);
  }
}
