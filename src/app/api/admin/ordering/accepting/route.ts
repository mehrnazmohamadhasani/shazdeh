import { prisma } from "@/lib/prisma";
import { ORDER_ROLES, ok, parseJson, requireAuth, revalidateSite, serverError } from "@/lib/api";
import { acceptingSchema } from "@/lib/ordering/admin-schemas";

/** The kitchen's "busy" switch — available to every staff role. */
export async function PATCH(req: Request) {
  const auth = await requireAuth(ORDER_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, acceptingSchema);
  if (!parsed.ok) return parsed.response;
  try {
    await prisma.orderingSettings.upsert({
      where: { id: "default" },
      update: parsed.data,
      create: { id: "default", ...parsed.data },
    });
    revalidateSite();
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
