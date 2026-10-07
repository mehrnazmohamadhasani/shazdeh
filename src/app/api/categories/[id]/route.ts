import { prisma } from "@/lib/prisma";
import { categoryUpdateSchema } from "@/lib/validators";
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
    const cat = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!cat) return notFound();
    return ok(cat);
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
  const parsed = await parseJson(req, categoryUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await ctx.params;
  try {
    const cat = await prisma.category.update({
      where: { id },
      data: parsed.data,
    });
    revalidateSite();
    return ok(cat);
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
    await prisma.category.delete({ where: { id } });
    revalidateSite();
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
