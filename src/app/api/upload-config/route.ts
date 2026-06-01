import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { isCloudinaryDirectUploadAvailable } from "@/lib/cloudinary-upload-sign";
import {
  MAX_DIRECT_CLOUDINARY_BYTES,
  getMaxServerUploadBytes,
} from "@/lib/upload-limits";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  return NextResponse.json({
    maxServerUploadBytes: getMaxServerUploadBytes(),
    cloudinaryDirectAvailable: isCloudinaryDirectUploadAvailable(),
    maxDirectCloudinaryBytes: MAX_DIRECT_CLOUDINARY_BYTES,
  });
}
