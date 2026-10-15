import { PURCHASING_ROLES, ok, requireAuth } from "@/lib/api";
import { readAgain } from "@/lib/ops/documents";
import { opsError } from "@/lib/ops/http";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Read the document with AI again (after a failure, or one that was discarded). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await readAgain(id, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
