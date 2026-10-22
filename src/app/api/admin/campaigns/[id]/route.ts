import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, requireAuth, serverError } from "@/lib/api";
import { campaignSchema } from "@/lib/campaigns/schema";

const EDITABLE = { in: ["DRAFT", "FAILED"] };

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, campaignSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    const res = await prisma.campaign.updateMany({ where: { id, status: EDITABLE }, data: parsed.data });
    if (res.count === 0) return NextResponse.json({ error: "A sent campaign can't be changed." }, { status: 409 });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    const res = await prisma.campaign.deleteMany({ where: { id, status: EDITABLE } });
    if (res.count === 0) return NextResponse.json({ error: "A sent campaign is kept as a record." }, { status: 409 });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
