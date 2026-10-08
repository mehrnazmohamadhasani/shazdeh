import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { created, ok, parseJson, requireAuth, serverError } from "@/lib/api";
import { teamMemberSchema } from "@/lib/ordering/admin-schemas";

const SELECT = { id: true, email: true, name: true, role: true, createdAt: true } as const;

export async function GET() {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  return ok(await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: SELECT }));
}

export async function POST(req: Request) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, teamMemberSchema);
  if (!parsed.ok) return parsed.response;
  const { password, ...rest } = parsed.data;
  try {
    const user = await prisma.user.create({
      data: { ...rest, email: rest.email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12) },
      select: SELECT,
    });
    return created(user);
  } catch (e) {
    return serverError(e);
  }
}
