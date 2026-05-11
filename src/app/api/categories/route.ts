import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";
import { created, ok, parseJson, requireAuth, serverError } from "@/lib/api";

export async function GET() {
  try {
    const list = await prisma.category.findMany({
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
    return created(cat);
  } catch (e) {
    return serverError(e);
  }
}
