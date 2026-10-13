import { NextResponse } from "next/server";
import { CMS_ROLES, requireAuth } from "@/lib/api";
import { ACCEPTED_TYPES, uploadDocument } from "@/lib/ops/documents";
import { opsError } from "@/lib/ops/http";
import { getMaxServerUploadBytes } from "@/lib/upload-limits";

export const runtime = "nodejs";
// The AI reading happens inside this request.
export const maxDuration = 120;

/** Upload a purchase document (photo or PDF); it is read by AI before this returns. */
export async function POST(req: Request) {
  const auth = await requireAuth(CMS_ROLES);
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
    const id = await uploadDocument(
      { data: Buffer.from(await file.arrayBuffer()), mimeType: file.type, name: file.name || null },
      auth.user.id,
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return opsError(e);
  }
}
