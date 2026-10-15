import { z } from "zod";
import { ok, parseJson, requireAuth } from "@/lib/api";
import { addFeeRule } from "@/lib/ops/sales";
import { opsError } from "@/lib/ops/http";

const schema = z.object({
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  commissionPct: z.number().min(0).max(100).nullable(),
  paymentFeePct: z.number().min(0).max(100).nullable(),
  fixedFee: z.number().min(0).max(1000).nullable(),
  vatOnFees: z.boolean(),
  note: z.string().trim().max(300).nullable(),
});

/** Add a platform's fee terms from a date. Admins only: they set every margin. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  const { fixedFee, ...rest } = parsed.data;
  try {
    const rule = await addFeeRule(id, { ...rest, fixedFeeFils: fixedFee == null ? null : Math.round(fixedFee * 100) }, auth.user);
    return ok({ id: rule.id });
  } catch (e) {
    return opsError(e);
  }
}
