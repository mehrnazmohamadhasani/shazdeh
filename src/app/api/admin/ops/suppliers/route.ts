import { PURCHASING_ROLES, created, parseJson, requireAuth } from "@/lib/api";
import { createSupplier } from "@/lib/ops/catalog";
import { supplierUpdateSchema } from "@/lib/ops/catalog-schemas";
import { opsError } from "@/lib/ops/http";

/** Add a supplier by hand, before its first invoice. */
export async function POST(req: Request) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, supplierUpdateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return created(await createSupplier(parsed.data, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
