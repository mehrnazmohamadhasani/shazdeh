import { prisma } from "@/lib/prisma";
import { created, ok, parseJson, requireAuth, serverError } from "@/lib/api";
import { couponSchema } from "@/lib/ordering/admin-schemas";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  return ok(await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function POST(req: Request) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, couponSchema);
  if (!parsed.ok) return parsed.response;
  const { startsAt, endsAt, ...rest } = parsed.data;
  try {
    return created(
      await prisma.coupon.create({
        data: { ...rest, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null },
      }),
    );
  } catch (e) {
    return serverError(e);
  }
}
