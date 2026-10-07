import { prisma } from "@/lib/prisma";
import { menuItemSchema } from "@/lib/validators";
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
    const items = await prisma.menuItem.findMany({
      where: isAdmin ? undefined : { category: { isActive: true } },
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
      include: { category: true, variants: true },
    });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, menuItemSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const item = await prisma.menuItem.create({
      data: parsed.data,
      include: { category: true },
    });
    revalidateSite();
    return created(item);
  } catch (e) {
    return serverError(e);
  }
}
