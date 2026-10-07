import { prisma } from "@/lib/prisma";
import { galleryImageUpdateSchema } from "@/lib/validators";
import {
  notFound,
  ok,
  parseJson,
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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, galleryImageUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    const img = await prisma.galleryImage.update({
      where: { id },
      data: parsed.data,
    });
    revalidateSite();
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
