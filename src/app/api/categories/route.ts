import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";
import { getSessionUser } from "@/lib/auth";
import {
  created,
  ok,
  parseJson,
  requireAuth,
  revalidateSite,
  serverError,
} from "@/lib/api";

export async function GET() {
  try {
    // Hidden / inactive records are only listed for signed-in admins.
    const isAdmin = Boolean(await getSessionUser());
    const list = await prisma.category.findMany({
      where: isAdmin ? undefined : { isActive: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { items: true } } },
    });
    return ok(list);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, categorySchema);
  if (!parsed.ok) return parsed.response;
  try {
    const cat = await prisma.category.create({ data: parsed.data });
    revalidateSite();
    return created(cat);
  } catch (e) {
    return serverError(e);
  }
}
