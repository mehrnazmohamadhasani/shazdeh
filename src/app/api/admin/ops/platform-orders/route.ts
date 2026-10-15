import { z } from "zod";
import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { savePlatformOrder } from "@/lib/ops/platform-import";
import { savePlatformOrderSchema } from "@/lib/ops/platform-save-schema";
import { opsError } from "@/lib/ops/http";

const schema = z.object({ documentId: z.string().nullable(), order: savePlatformOrderSchema });

/** Save a checked platform receipt as a sale. */
export async function POST(req: Request) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  try {
    const order = await savePlatformOrder(parsed.data.documentId, parsed.data.order, auth.user);
    return ok({ id: order.id });
  } catch (e) {
    return opsError(e);
  }
}
