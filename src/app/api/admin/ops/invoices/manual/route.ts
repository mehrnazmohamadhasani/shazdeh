import { PURCHASING_ROLES, created, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { startManualInvoice } from "@/lib/ops/documents";

/** Starts an invoice typed in by hand (no photo): opens the usual review screen, empty. */
export async function POST() {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  try {
    return created({ id: await startManualInvoice(auth.user) });
  } catch (e) {
    return opsError(e);
  }
}
