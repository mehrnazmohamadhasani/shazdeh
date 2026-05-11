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

function assertPlausibleCloudinaryApiKey(key: string) {
  const k = key.trim();
  if (!k) {
    throw new Error("CLOUDINARY_API_KEY is empty in Vercel environment variables.");
  }
  if (k === "CLOUDINARY_API_KEY" || k === "<API_KEY>" || /^your[_-]?api[_-]?key$/i.test(k)) {
    throw new Error(
      "CLOUDINARY_API_KEY is set to a placeholder. In Vercel, set the value to the numeric API Key from Cloudinary (Dashboard → API Keys), not the variable name.",
    );
  }
  // Cloudinary API keys are numeric strings (typical length 9–15).
  if (!/^\d{6,20}$/.test(k)) {
    throw new Error(
      "CLOUDINARY_API_KEY does not look valid. In Cloudinary open API Keys and copy the API Key (digits only). Paste it as the value for CLOUDINARY_API_KEY in Vercel. Do not paste the API Secret here.",
    );
  }
}

/** Params for browser → Cloudinary direct upload (avoids Vercel ~4.5MB body limit). */
export function createCloudinarySignedUploadPayload(folderInput: string) {
  if (!isCloudinaryDirectUploadAvailable()) {
    throw new Error("Cloudinary is not configured for uploads");
  }
  const apiKey = env.CLOUDINARY_API_KEY!;
  assertPlausibleCloudinaryApiKey(apiKey);
  const folderPath = `shazdeh/${sanitizeFolder(folderInput)}`;
  const timestamp = Math.round(Date.now() / 1000).toString();
  const sigParams = `folder=${folderPath}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash("sha1").update(sigParams).digest("hex");
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    apiKey,
    timestamp,
    signature,
    folder: folderPath,
  };
}
