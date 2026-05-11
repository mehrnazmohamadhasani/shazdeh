import { prisma } from "@/lib/prisma";
import { settingsUpdateSchema } from "@/lib/validators";
import { ok, parseJson, requireAuth, serverError } from "@/lib/api";

export async function GET() {
  try {
    const settings = await prisma.restaurantSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", brandName: "Shazdeh" },
    });
    return ok(settings);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, settingsUpdateSchema);
  if (!parsed.ok) return parsed.response;

  // strip empty strings → null
  const data = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) =>
      typeof v === "string" && v.trim() === "" ? [k, null] : [k, v],
    ),
  );

  try {
    const settings = await prisma.restaurantSettings.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", brandName: "Shazdeh", ...data },
    });
    return ok(settings);
  } catch (e) {
    return serverError(e);
  }
}
