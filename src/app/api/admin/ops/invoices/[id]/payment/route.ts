import { NextResponse } from "next/server";
import { z } from "zod";
import { CMS_ROLES, ok, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { ACCEPTED_TYPES, PAYMENT_METHODS, RECEIPT_KINDS, setInvoicePayment } from "@/lib/ops/documents";
import { getMaxServerUploadBytes } from "@/lib/upload-limits";

export const runtime = "nodejs";

const schema = z.object({
  method: z.enum(PAYMENT_METHODS),
  paid: z.boolean(),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  paidBy: z.string().trim().max(80).nullable().default(null),
  personal: z.boolean().default(false),
  receiptKind: z.enum(RECEIPT_KINDS).nullable().default(null),
  removeReceipt: z.boolean().default(false),
});

/**
 * How an invoice is paid (cash, card, transfer, on account), whether it is
 * paid, with whose money, and an optional receipt photo. Sent as a form:
 * "payment" (JSON) and "receipt" (file). Money pages' users only.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    const form = await req.formData();
    let json: unknown;
    try {
      json = JSON.parse(String(form.get("payment") ?? ""));
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const file = form.get("receipt");
    let receipt = null;
    if (file instanceof File && file.size > 0) {
      if (!ACCEPTED_TYPES.includes(file.type)) return NextResponse.json({ error: "Use a photo (JPG, PNG, WebP) or a PDF." }, { status: 400 });
      if (file.size > getMaxServerUploadBytes()) {
        return NextResponse.json({ error: "File too large — take the photo again or send a smaller PDF." }, { status: 413 });
      }
      receipt = { data: Buffer.from(await file.arrayBuffer()), mimeType: file.type, name: file.name || null };
    }
    await setInvoicePayment(id, { ...parsed.data, receipt }, auth.user);
    return ok({ saved: true });
  } catch (e) {
    return opsError(e);
  }
}
