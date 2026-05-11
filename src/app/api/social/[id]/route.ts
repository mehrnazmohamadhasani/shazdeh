import { prisma } from "@/lib/prisma";
import { socialLinkUpdateSchema } from "@/lib/validators";
import {
  notFound,
  ok,
  parseJson,
  requireAuth,
  serverError,
} from "@/lib/api";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const link = await prisma.socialLink.findUnique({ where: { id } });
  if (!link) return notFound();
  return ok(link);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, socialLinkUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    const link = await prisma.socialLink.update({
      where: { id },
      data: parsed.data,
    });
    return ok(link);
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
    await prisma.socialLink.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
