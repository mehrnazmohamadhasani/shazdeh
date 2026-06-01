import { NextResponse } from "next/server";
import { requireAuth, serverError } from "@/lib/api";
import { uploadImage } from "@/lib/storage";
import { getMaxServerUploadBytes } from "@/lib/upload-limits";

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
    const name = file.name.toLowerCase();
    const looksLikeImage =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|avif)$/i.test(name);
    if (!looksLikeImage) {
      return NextResponse.json(
        {
          error:
            "Unsupported image type. Use JPG or PNG (on iPhone: Settings → Camera → Formats → Most Compatible).",
        },
        { status: 400 },
      );
    }
    const maxBytes = getMaxServerUploadBytes();
    if (file.size > maxBytes) {
      const maxMb = Math.round(maxBytes / (1024 * 1024));
      return NextResponse.json(
        {
          error: `File too large (max ${maxMb}MB on this host). Resize or compress the image, or use Cloudinary for larger files.`,
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
