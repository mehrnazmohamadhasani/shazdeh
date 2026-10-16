import { PURCHASING_ROLES, ok, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { listConversations } from "@/lib/ops/assistant/conversations";

/** This person's latest conversations with the assistant. */
export async function GET() {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  try {
    return ok({ conversations: await listConversations(auth.user) });
  } catch (e) {
    return opsError(e);
  }
}
