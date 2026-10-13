import { CMS_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { recordCount } from "@/lib/ops/catalog";
import { countSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Save a stock count; differences become COUNT movements. */
export async function POST(req: Request) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, countSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(await recordCount(parsed.data.counts, parsed.data.day, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
