import { prisma } from "@/lib/prisma";
import { socialLinkSchema } from "@/lib/validators";
import { created, ok, parseJson, requireAuth, serverError } from "@/lib/api";

export async function GET() {
  try {
    const list = await prisma.socialLink.findMany({
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
  const parsed = await parseJson(req, socialLinkSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const link = await prisma.socialLink.create({ data: parsed.data });
    return created(link);
  } catch (e) {
    return serverError(e);
  }
}
