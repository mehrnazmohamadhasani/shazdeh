import { prisma } from "@/lib/prisma";
import {
  notFound,
  ok,
  requireAuth,
  revalidateSite,
  serverError,
} from "@/lib/api";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const img = await prisma.galleryImage.findUnique({ where: { id } });
    if (!img) return notFound();
    return ok(img);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await prisma.galleryImage.delete({ where: { id } });
    revalidateSite();
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
