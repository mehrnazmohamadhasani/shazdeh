import { prisma } from "@/lib/prisma";
import { bannerUpdateSchema } from "@/lib/validators";
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
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) return notFound();
    return ok(banner);
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
  const parsed = await parseJson(req, bannerUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    const b = await prisma.banner.update({
      where: { id },
      data: parsed.data,
    });
    revalidateSite();
    return ok(b);
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
    await prisma.banner.delete({ where: { id } });
    revalidateSite();
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
