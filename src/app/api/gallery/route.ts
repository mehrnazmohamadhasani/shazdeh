import { prisma } from "@/lib/prisma";
import { galleryImageSchema } from "@/lib/validators";
import { created, ok, parseJson, requireAuth, serverError } from "@/lib/api";

export async function GET() {
  try {
    const list = await prisma.galleryImage.findMany({
      orderBy: { order: "asc" },
    });
    return ok(list);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, galleryImageSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const img = await prisma.galleryImage.create({ data: parsed.data });
    return created(img);
  } catch (e) {
    return serverError(e);
  }
}
