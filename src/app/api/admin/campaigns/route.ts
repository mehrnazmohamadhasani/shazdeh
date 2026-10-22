import { prisma } from "@/lib/prisma";
import { created, requireAuth, serverError } from "@/lib/api";

/** Starts a draft with a friendly example the owner edits. */
export async function POST() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  try {
    return created(
      await prisma.campaign.create({
        data: {
          subject: "Something new at SHĀZDEH",
          heading: "Nooshe jan!",
          body: "We've been cooking something new for you.\n\nOrder this week on our website and enjoy it at home.",
          buttonLabel: "Order now",
          buttonUrl: "/order",
          createdBy: auth.user.email,
        },
        select: { id: true },
      }),
    );
  } catch (e) {
    return serverError(e);
  }
}
