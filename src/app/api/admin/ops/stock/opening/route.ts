import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { recordOpeningStock } from "@/lib/ops/catalog";
import { openingSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Save the opening stock: what was in the kitchen on the first day. */
export async function POST(req: Request) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, openingSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(await recordOpeningStock(parsed.data.day, parsed.data.rows, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
