import { z } from "zod";
import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { confirmAction } from "@/lib/ops/assistant/actions";

const schema = z.object({ sure: z.boolean().default(false) });

/** Apply a suggested change. Sensitive ones need `sure` (the second tap). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return ok({ action: await confirmAction(id, auth.user, parsed.data.sure) });
  } catch (e) {
    return opsError(e);
  }
}
