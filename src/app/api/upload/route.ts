import { NextResponse } from "next/server";
import { requireAuth, serverError } from "@/lib/api";
import { uploadImage } from "@/lib/storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const folder = (form.get("folder") as string | null) ?? "general";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error:
            "File too large (max 3MB on this host). Resize or compress the image, then try again.",
        },
        { status: 413 },
      );
    }

    const result = await uploadImage(file, { folder });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
