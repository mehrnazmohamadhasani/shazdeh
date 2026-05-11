import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

function sanitizeFolder(input?: string) {
  if (!input) return "general";
  return input.replace(/[^a-z0-9-]/gi, "").slice(0, 32) || "general";
}

export function isCloudinaryDirectUploadAvailable(): boolean {
  return (
    env.STORAGE_DRIVER === "cloudinary" &&
    Boolean(env.CLOUDINARY_CLOUD_NAME) &&
    Boolean(env.CLOUDINARY_API_KEY) &&
    Boolean(env.CLOUDINARY_API_SECRET)
  );
}

/** Params for browser → Cloudinary direct upload (avoids Vercel ~4.5MB body limit). */
export function createCloudinarySignedUploadPayload(folderInput: string) {
  if (!isCloudinaryDirectUploadAvailable()) {
    throw new Error("Cloudinary is not configured for uploads");
  }
  const folderPath = `shazdeh/${sanitizeFolder(folderInput)}`;
  const timestamp = Math.round(Date.now() / 1000).toString();
  const sigParams = `folder=${folderPath}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash("sha1").update(sigParams).digest("hex");
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    apiKey: env.CLOUDINARY_API_KEY!,
    timestamp,
    signature,
    folder: folderPath,
  };
}
