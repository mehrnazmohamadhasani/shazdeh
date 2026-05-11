import { prisma } from "@/lib/prisma";
import { menuItemSchema } from "@/lib/validators";
import { created, ok, parseJson, requireAuth, serverError } from "@/lib/api";

export async function GET() {
  try {
    const items = await prisma.menuItem.findMany({
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
    return created(item);
  } catch (e) {
    return serverError(e);
  }
}
