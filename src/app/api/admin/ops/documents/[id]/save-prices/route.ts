import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { saveQuotationPrices } from "@/lib/ops/documents";
import { opsError } from "@/lib/ops/http";
import { saveInvoiceSchema } from "@/lib/ops/save-schema";

export const runtime = "nodejs";

/** Confirm a reviewed quotation: keeps its prices only — no invoice, no cost, no stock. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, saveInvoiceSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return ok(await saveQuotationPrices(id, parsed.data, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
