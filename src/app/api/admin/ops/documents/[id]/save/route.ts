import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { saveDocument } from "@/lib/ops/documents";
import { opsError } from "@/lib/ops/http";
import { saveInvoiceSchema } from "@/lib/ops/save-schema";

export const runtime = "nodejs";

/** Confirm a reviewed reading: creates the invoice, stock movements and supplier memory. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, saveInvoiceSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return ok(await saveDocument(id, parsed.data, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
