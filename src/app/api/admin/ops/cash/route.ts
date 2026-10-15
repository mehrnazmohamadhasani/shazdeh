import { z } from "zod";
import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { addWithdrawal } from "@/lib/ops/cash";
import { opsError } from "@/lib/ops/http";
import { toFils } from "@/lib/ordering/money";

const schema = z.object({
  person: z.string().trim().min(1).max(80),
  amount: z.number().positive().max(1_000_000),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(300).nullable(),
});

/** Record cash someone took from the business account for purchases. */
export async function POST(req: Request) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  try {
    const row = await addWithdrawal({ ...parsed.data, amountFils: toFils(parsed.data.amount) }, auth.user);
    return ok({ id: row.id });
  } catch (e) {
    return opsError(e);
  }
}
