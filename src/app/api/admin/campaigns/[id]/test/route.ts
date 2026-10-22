import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notFound, ok, parseJson, requireAuth, serverError } from "@/lib/api";
import { sendTestEmail } from "@/lib/campaigns/send";

/** Sends the saved campaign to one address, marked [TEST]. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, z.object({ to: z.email().max(160) }));
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return notFound();
    await sendTestEmail(campaign, parsed.data.to);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof Error && /Missing settings|Resend/.test(e.message)) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    return serverError(e);
  }
}
