import { z } from "zod";
import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { priceFreeFood } from "@/lib/ops/free-food";
import { freeFoodItemsSchema, freeFoodStockSchema } from "@/lib/ops/free-food-shared";

const schema = z.object({ items: freeFoodItemsSchema.default([]), stock: freeFoodStockSchema });

/** What a list of dishes and stock items costs (recipes / amounts × latest prices) and sells for, before it is recorded. */
export async function POST(req: Request) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(await priceFreeFood(parsed.data.items, parsed.data.stock));
  } catch (e) {
    return opsError(e);
  }
}
