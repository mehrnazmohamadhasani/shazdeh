import { CMS_ROLES, ok, requireAuth } from "@/lib/api";
import { deleteUnusedIngredients } from "@/lib/ops/catalog";
import { opsError } from "@/lib/ops/http";

/** Delete every ingredient nothing uses (no recipe, no invoice that counts, no real stock history). */
export async function DELETE() {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  try {
    return ok(await deleteUnusedIngredients(auth.user));
  } catch (e) {
    return opsError(e);
  }
}
