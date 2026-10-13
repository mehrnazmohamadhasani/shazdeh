import { CMS_ROLES, notFound, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** The original file — private, admins only. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const doc = await prisma.opsDocument.findUnique({ where: { id }, select: { data: true, mimeType: true } });
  if (!doc) return notFound();
  return new Response(Buffer.from(doc.data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
