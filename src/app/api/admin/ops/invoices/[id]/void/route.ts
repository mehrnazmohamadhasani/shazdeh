import { z } from "zod";
import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { voidInvoice } from "@/lib/ops/documents";
import { opsError } from "@/lib/ops/http";

const schema = z.object({ reason: z.string().trim().min(2).max(300) });

/** Undo a saved invoice: reverses its stock and sends the document back to review. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return ok(await voidInvoice(id, parsed.data.reason, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
