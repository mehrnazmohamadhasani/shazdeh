import { PURCHASING_ROLES, ok, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { deleteConversation, getConversation } from "@/lib/ops/assistant/conversations";

/** One of this person's conversations, with its messages and change cards. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    return ok({ conversation: await getConversation(id, auth.user) });
  } catch (e) {
    return opsError(e);
  }
}

/** Deletes the conversation's words; the changes it made stay (and stay undoable). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await deleteConversation(id, auth.user);
    return ok({ deleted: true });
  } catch (e) {
    return opsError(e);
  }
}
