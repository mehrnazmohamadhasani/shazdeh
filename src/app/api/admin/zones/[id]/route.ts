import { prisma } from "@/lib/prisma";
import { ok, parseJson, requireAuth, revalidateSite, serverError } from "@/lib/api";
import { zoneSchema } from "@/lib/ordering/admin-schemas";

/** Replaces a zone and its list of areas. Existing areas are matched by name so their ids stay stable. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, zoneSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  const { areas, ...zone } = parsed.data;
  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.deliveryZone.update({ where: { id }, data: zone });
      const names = areas.map((a) => a.name);
      await tx.deliveryArea.deleteMany({ where: { zoneId: id, name: { notIn: names } } });
      for (const [i, a] of areas.entries()) {
        // An area moves here from another zone if it already exists elsewhere.
        await tx.deliveryArea.upsert({
          where: { name: a.name },
          update: { zoneId: id, lat: a.lat ?? null, lng: a.lng ?? null, order: i, isActive: true },
          create: { zoneId: id, name: a.name, lat: a.lat ?? null, lng: a.lng ?? null, order: i },
        });
      }
      return tx.deliveryZone.findUnique({ where: { id }, include: { areas: { orderBy: { name: "asc" } } } });
    });
    revalidateSite();
    return ok(row);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    await prisma.deliveryZone.delete({ where: { id } });
    revalidateSite();
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
