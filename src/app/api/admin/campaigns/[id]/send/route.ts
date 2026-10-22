import { NextResponse } from "next/server";
import { ok, requireAuth, serverError } from "@/lib/api";
import { sendCampaign } from "@/lib/campaigns/send";

// Copying a few hundred contacts into Resend at 10 requests a second takes a while.
export const maxDuration = 300;

/** Sends the campaign to its audience. Admins only. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    const result = await sendCampaign(id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
