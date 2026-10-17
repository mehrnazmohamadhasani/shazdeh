import { PURCHASING_ROLES, created, parseJson, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { recordFreeFood } from "@/lib/ops/free-food";
import { freeFoodSchema } from "@/lib/ops/free-food-shared";

/** Record free food (staff meal, gift, tasting, compensation): stock out by recipe, cost kept as of now. */
export async function POST(req: Request) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, freeFoodSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return created(await recordFreeFood(parsed.data, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
