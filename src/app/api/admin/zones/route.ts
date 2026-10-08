import { prisma } from "@/lib/prisma";
import { created, ok, parseJson, requireAuth, revalidateSite, serverError } from "@/lib/api";
import { zoneSchema } from "@/lib/ordering/admin-schemas";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const zones = await prisma.deliveryZone.findMany({ orderBy: { order: "asc" }, include: { areas: { orderBy: { name: "asc" } } } });
  return ok(zones);
}

export async function POST(req: Request) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, zoneSchema);
  if (!parsed.ok) return parsed.response;
  const { areas, ...zone } = parsed.data;
  try {
    const row = await prisma.deliveryZone.create({
      data: { ...zone, areas: { create: areas } },
      include: { areas: true },
    });
    revalidateSite();
    return created(row);
  } catch (e) {
    return serverError(e);
  }
}
