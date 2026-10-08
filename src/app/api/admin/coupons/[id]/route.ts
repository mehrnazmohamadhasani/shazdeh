import { prisma } from "@/lib/prisma";
import { ok, parseJson, requireAuth, serverError } from "@/lib/api";
import { couponSchema } from "@/lib/ordering/admin-schemas";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, couponSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  const { startsAt, endsAt, ...rest } = parsed.data;
  try {
    return ok(
      await prisma.coupon.update({
        where: { id },
        data: { ...rest, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null },
      }),
    );
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    // Orders keep the code as text, so deleting a coupon never breaks history.
    await prisma.coupon.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
