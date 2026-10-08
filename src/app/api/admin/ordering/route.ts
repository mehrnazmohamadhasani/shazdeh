import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, requireAuth, revalidateSite, serverError } from "@/lib/api";
import { orderingSettingsSchema } from "@/lib/ordering/admin-schemas";
import { getOnlineProvider } from "@/lib/payments";

export async function PATCH(req: Request) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, orderingSettingsSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  if (data.paymentMethods?.includes("ONLINE") && !getOnlineProvider()) {
    return NextResponse.json(
      { error: "Online payment needs a payment provider configured on the server first (PAYMENT_PROVIDER)." },
      { status: 422 },
    );
  }
  try {
    const row = await prisma.orderingSettings.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...data },
    });
    revalidateSite();
    return ok(row);
  } catch (e) {
    return serverError(e);
  }
}
