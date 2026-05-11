import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, serverError } from "@/lib/api";
import { createCloudinarySignedUploadPayload } from "@/lib/cloudinary-upload-sign";

/** Top-level route (not under `/api/upload/`) so it is not shadowed by `upload/route.ts`. */

export const runtime = "nodejs";

const bodySchema = z.object({
  folder: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const payload = createCloudinarySignedUploadPayload(
      parsed.data.folder ?? "general",
    );
    return NextResponse.json(payload);
  } catch (e) {
    return serverError(e);
  }
}
