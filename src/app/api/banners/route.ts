import { prisma } from "@/lib/prisma";
import { bannerSchema } from "@/lib/validators";
import { created, ok, parseJson, requireAuth, serverError } from "@/lib/api";

export async function GET() {
  try {
    const list = await prisma.banner.findMany({
      orderBy: [{ position: "asc" }, { order: "asc" }],
    });
    return ok(list);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, bannerSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const banner = await prisma.banner.create({ data: parsed.data });
    return created(banner);
  } catch (e) {
    return serverError(e);
  }
}
