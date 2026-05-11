import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/env";

export type UploadResult = {
  url: string;
  width: number;
  height: number;
  bytes: number;
  storage: "local" | "supabase" | "cloudinary";
};

const UPLOADS_DIR = path.join(process.cwd(), "public/uploads");
const PUBLIC_PREFIX = "/uploads";

const MAX_WIDTH = 2400;
const QUALITY = 84;

export async function uploadImage(
  file: File,
  options?: { folder?: string; quality?: number; maxWidth?: number },
): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported");
  }
  const buf = Buffer.from(await file.arrayBuffer());

  const optimized = await sharp(buf)
    .rotate()
    .resize({
      width: options?.maxWidth ?? MAX_WIDTH,
      withoutEnlargement: true,
    })
    .jpeg({ quality: options?.quality ?? QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const filename = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.jpg`;
  const folder = sanitizeFolder(options?.folder);

  switch (env.STORAGE_DRIVER) {
    case "supabase":
      return uploadToSupabase(optimized.data, filename, folder, optimized.info);
    case "cloudinary":
      return uploadToCloudinary(optimized.data, filename, folder, optimized.info);
    default:
      return uploadToLocal(optimized.data, filename, folder, optimized.info);
  }
}

function sanitizeFolder(input?: string) {
  if (!input) return "general";
  return input.replace(/[^a-z0-9-]/gi, "").slice(0, 32) || "general";
}

async function uploadToLocal(
  data: Buffer,
  filename: string,
  folder: string,
  info: sharp.OutputInfo,
): Promise<UploadResult> {
  const dir = path.join(UPLOADS_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, data);
  return {
    url: `${PUBLIC_PREFIX}/${folder}/${filename}`,
    width: info.width,
    height: info.height,
    bytes: data.length,
    storage: "local",
  };
}

async function uploadToSupabase(
  data: Buffer,
  filename: string,
  folder: string,
  info: sharp.OutputInfo,
): Promise<UploadResult> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || !env.SUPABASE_BUCKET) {
    throw new Error("Supabase storage env vars are not configured");
  }
  const filePath = `${folder}/${filename}`;
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${
    env.SUPABASE_BUCKET
  }/${filePath}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
    },
    body: new Uint8Array(data),
  });
  if (!res.ok) {
    throw new Error(`Supabase upload failed: ${res.status} ${await res.text()}`);
  }

  const publicUrl = `${env.SUPABASE_URL.replace(
    /\/$/,
    "",
  )}/storage/v1/object/public/${env.SUPABASE_BUCKET}/${filePath}`;

  return {
    url: publicUrl,
    width: info.width,
    height: info.height,
    bytes: data.length,
    storage: "supabase",
  };
}

async function uploadToCloudinary(
  data: Buffer,
  _filename: string,
  folder: string,
  info: sharp.OutputInfo,
): Promise<UploadResult> {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Cloudinary env vars are not configured");
  }

  const timestamp = Math.round(Date.now() / 1000).toString();
  const folderPath = `shazdeh/${folder}`;
  const sigParams = `folder=${folderPath}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const signature = await sha1Hex(sigParams);

  const form = new FormData();
  const blob = new Blob([new Uint8Array(data)], { type: "image/jpeg" });
  form.append("file", blob);
  form.append("api_key", env.CLOUDINARY_API_KEY);
  form.append("timestamp", timestamp);
  form.append("folder", folderPath);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    throw new Error(
      `Cloudinary upload failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { secure_url: string };
  return {
    url: json.secure_url,
    width: info.width,
    height: info.height,
    bytes: data.length,
    storage: "cloudinary",
  };
}

async function sha1Hex(input: string) {
  const crypto = await import("node:crypto");
  return crypto.createHash("sha1").update(input).digest("hex");
}
