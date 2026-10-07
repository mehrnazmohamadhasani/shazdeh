import { prisma } from "@/lib/prisma";
import { settingsUpdateSchema } from "@/lib/validators";
import {
  ok,
  parseJson,
  requireAuth,
  revalidateSite,
  serverError,
} from "@/lib/api";

export async function GET() {
  try {
    // Read-only: a GET must never create rows.
    const settings = await prisma.restaurantSettings.findUnique({
      where: { id: "default" },
    });
    return ok(settings ?? { id: "default", brandName: "SHĀZDEH" });
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
      create: { id: "default", brandName: "SHĀZDEH", ...data },
    });
    revalidateSite();
    return ok(settings);
  } catch (e) {
    return serverError(e);
  }
}
