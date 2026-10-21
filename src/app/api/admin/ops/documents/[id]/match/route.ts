import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { matchLinesWithAi, matchRequestSchema } from "@/lib/ops/ai-match";
import { opsError } from "@/lib/ops/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Suggest which stock ingredient each unlinked invoice line is (never applied by itself). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, matchRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return ok({ matches: await matchLinesWithAi(id, parsed.data.lines) });
  } catch (e) {
    return opsError(e);
  }
}
