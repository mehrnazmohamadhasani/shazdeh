import { prisma } from "@/lib/prisma";
import { notFound, ok, parseJson, requireAuth, revalidateSite, serverError } from "@/lib/api";
import { modifiersSchema } from "@/lib/ordering/admin-schemas";

const INCLUDE = { modifierGroups: { orderBy: { order: "asc" as const }, include: { options: { orderBy: { order: "asc" as const } } } } };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const item = await prisma.menuItem.findUnique({ where: { id }, include: INCLUDE });
  return item ? ok(item.modifierGroups) : notFound();
}

/**
 * Replaces a dish's option groups. Past orders keep their own snapshot
 * of chosen options, so rewriting groups never alters order history.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, modifiersSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    const exists = await prisma.menuItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return notFound();
    await prisma.$transaction(async (tx) => {
      await tx.modifierGroup.deleteMany({ where: { itemId: id } });
      for (const [gi, g] of parsed.data.groups.entries()) {
        await tx.modifierGroup.create({
          data: {
            itemId: id,
            name: g.name,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            order: gi,
            options: { create: g.options.map((o, oi) => ({ name: o.name, price: o.price, isAvailable: o.isAvailable, order: oi })) },
          },
        });
      }
    });
    revalidateSite();
    const item = await prisma.menuItem.findUnique({ where: { id }, include: INCLUDE });
    return ok(item?.modifierGroups ?? []);
  } catch (e) {
    return serverError(e);
  }
}
