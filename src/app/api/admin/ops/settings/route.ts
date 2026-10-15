import { z } from "zod";
import { ok, parseJson, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { updateOpsSettings } from "@/lib/ops/settings";

const schema = z.object({
  foodCostIncludesVat: z.boolean().optional(),
  aiMonthlyCapUsd: z.number().min(0).max(10_000).optional(),
  autoSavePlatform: z.boolean().optional(),
  autoSaveInvoices: z.boolean().optional(),
});

/** Food cost with/without VAT and the monthly AI limit. Admins only. */
export async function PATCH(req: Request) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(await updateOpsSettings(parsed.data, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
