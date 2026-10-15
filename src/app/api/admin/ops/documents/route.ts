import { NextResponse } from "next/server";
import { CMS_ROLES, PURCHASING_ROLES, requireAuth } from "@/lib/api";
import { ACCEPTED_TYPES, uploadDocument } from "@/lib/ops/documents";
import { opsError } from "@/lib/ops/http";
import { getMaxServerUploadBytes } from "@/lib/upload-limits";

export const runtime = "nodejs";
// The AI reading happens inside this request.
export const maxDuration = 120;

/** Upload a purchase document, a recipe sheet or a platform receipt (photo or PDF); it is read by AI before this returns. */
export async function POST(req: Request) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Use a photo (JPG, PNG, WebP) or a PDF." }, { status: 400 });
    }
    if (file.size > getMaxServerUploadBytes()) {
      return NextResponse.json({ error: "File too large — take the photo again or send a smaller PDF." }, { status: 413 });
    }
    const asked = form.get("kind");
    const kind = asked === "recipe" ? "recipe" : asked === "platform_order" ? "platform_order" : "supplier_invoice";
    // Recipe sheets are for the menu team, not the purchaser.
    if (kind === "recipe" && !CMS_ROLES.includes(auth.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const id = await uploadDocument(
      { data: Buffer.from(await file.arrayBuffer()), mimeType: file.type, name: file.name || null },
      auth.user.id,
      kind,
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return opsError(e);
  }
}
