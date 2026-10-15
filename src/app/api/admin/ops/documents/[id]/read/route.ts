import { PURCHASING_ROLES, notFound, ok, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { processDocument } from "@/lib/ops/documents";
import { opsError } from "@/lib/ops/http";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Read the document with AI again (e.g. after a failure). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    const doc = await prisma.opsDocument.findUnique({ where: { id }, select: { status: true } });
    if (!doc) return notFound();
    if (doc.status === "SAVED") return ok({ error: "Already saved." }, { status: 409 });
    await processDocument(id);
    return ok({ id });
  } catch (e) {
    return opsError(e);
  }
}
