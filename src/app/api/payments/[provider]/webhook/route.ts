import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getProviderById } from "@/lib/payments";
import { applyPaymentResult } from "@/lib/ordering/orders";

/**
 * Gateway webhooks. The signature is verified by the provider adapter
 * against the raw body; each event id is processed once.
 */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = getProviderById(id);
  if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

  const raw = await req.text();
  let result;
  try {
    result = await provider.parseWebhook(raw, req.headers);
  } catch (e) {
    console.warn(`[payments:${id}] rejected webhook:`, (e as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!result) return NextResponse.json({ received: true });

  try {
    await prisma.webhookEvent.create({ data: { provider: id, eventId: result.eventId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw e;
  }

  try {
    await applyPaymentResult(id, result.providerRef, result.state, result.failureReason);
  } catch (e) {
    // Let the gateway retry: forget the event id so the retry is processed.
    await prisma.webhookEvent.deleteMany({ where: { provider: id, eventId: result.eventId } });
    console.error(`[payments:${id}] webhook processing failed`, e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
