import { NextResponse } from "next/server";
import { PURCHASING_ROLES, ok, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { sharedRateLimit } from "@/lib/rate-limit";
import { MAX_VOICE_BYTES, voiceNote } from "@/lib/ops/assistant/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

/** A voice note: stored as a document, and what was said comes back to be checked before sending. */
export async function POST(req: Request) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const limited = await sharedRateLimit(`assistant-voice:${auth.user.id}`, { limit: 40, windowMs: 10 * 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "Too many voice notes. Wait a minute and try again." }, { status: 429 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No recording provided" }, { status: 400 });
    if (file.size > MAX_VOICE_BYTES) return NextResponse.json({ error: "The recording is too long. Keep voice notes under a minute." }, { status: 413 });
    return ok(await voiceNote({ data: Buffer.from(await file.arrayBuffer()), mimeType: file.type }, auth.user));
  } catch (e) {
    return opsError(e);
  }
}
