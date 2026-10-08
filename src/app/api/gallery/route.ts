import { prisma } from "@/lib/prisma";
import { galleryImageSchema } from "@/lib/validators";
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
    const list = await prisma.galleryImage.findMany({ orderBy: { order: "asc" } });
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
    // New photos go to the end of the gallery.
    const last = await prisma.galleryImage.aggregate({ _max: { order: true } });
    const img = await prisma.galleryImage.create({
      data: { ...parsed.data, order: (last._max.order ?? 0) + 1 },
    });
    revalidateSite();
    return created(img);
  } catch (e) {
    return serverError(e);
  }
}
