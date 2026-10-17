import { z } from "zod";
import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { priceFreeFood } from "@/lib/ops/free-food";
import { freeFoodSchema } from "@/lib/ops/free-food-shared";

const schema = z.object({ items: freeFoodSchema.shape.items });

/** What a list of dishes costs (approved recipes × latest prices) and sells for, before it is recorded. */
export async function POST(req: Request) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(await priceFreeFood(parsed.data.items));
  } catch (e) {
    return opsError(e);
  }
}
