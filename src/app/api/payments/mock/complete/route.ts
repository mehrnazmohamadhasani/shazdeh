import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/api";
import { getProviderById } from "@/lib/payments";
import { applyPaymentResult } from "@/lib/ordering/orders";

/** Development-only: approve or decline a mock online payment. */
export async function POST(req: Request) {
  if (!getProviderById("mock")) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const parsed = await parseJson(
    req,
    z.object({ token: z.string().min(16).max(64), outcome: z.enum(["approve", "decline"]) }),
  );
  if (!parsed.ok) return parsed.response;
  const payment = await prisma.payment.findFirst({
    where: { provider: "mock", order: { trackingToken: parsed.data.token } },
    select: { providerRef: true },
  });
  if (!payment?.providerRef) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await applyPaymentResult(
    "mock",
    payment.providerRef,
    parsed.data.outcome === "approve" ? "PAID" : "FAILED",
    parsed.data.outcome === "decline" ? "Card declined (test)" : undefined,
  );
  return NextResponse.json({ ok: true });
}
