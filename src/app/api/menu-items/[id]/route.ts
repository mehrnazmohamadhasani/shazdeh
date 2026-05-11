import { prisma } from "@/lib/prisma";
import { menuItemUpdateSchema } from "@/lib/validators";
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
  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: { category: true, variants: true },
  });
  if (!item) return notFound();
  return ok(item);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, menuItemUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await ctx.params;
  try {
    const item = await prisma.menuItem.update({
      where: { id },
      data: parsed.data,
      include: { category: true },
    });
    return ok(item);
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
    await prisma.menuItem.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
