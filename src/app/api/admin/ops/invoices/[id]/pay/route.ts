import { z } from "zod";
import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { markInvoicePaid } from "@/lib/ops/documents";
import { opsError } from "@/lib/ops/http";

const schema = z.object({
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paidBy: z.string().trim().max(80).nullable(),
  note: z.string().trim().max(300).nullable(),
});

/** Mark a credit invoice as paid. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    await markInvoicePaid(id, parsed.data, auth.user);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
