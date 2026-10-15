import { PURCHASING_ROLES, notFound, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { processPlatformDocument } from "@/lib/ops/platform-import";
import { opsError } from "@/lib/ops/http";

export const runtime = "nodejs";
export const maxDuration = 120;

/** A receipt uploaded as an invoice turned out to be a platform order: read it as a sale. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    const doc = await prisma.opsDocument.findUnique({ where: { id }, select: { status: true } });
    if (!doc) return notFound();
    if (doc.status === "SAVED") return ok({ error: "Already saved." }, { status: 409 });
    await processPlatformDocument(id);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
