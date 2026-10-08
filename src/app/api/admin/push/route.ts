import { ORDER_ROLES, ok, parseJson, requireAuth, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { pushSubscriptionSchema } from "@/lib/ordering/admin-schemas";

/** Registers this device for new-order push alerts for the signed-in staff member. */
export async function POST(req: Request) {
  const auth = await requireAuth(ORDER_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, pushSubscriptionSchema);
  if (!parsed.ok) return parsed.response;
  const { endpoint, keys } = parsed.data;
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: auth.user.id },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId: auth.user.id, orderId: null },
    });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
