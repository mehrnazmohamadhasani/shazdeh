import { MAX_DIRECT_CLOUDINARY_BYTES } from "@/lib/upload-limits";

export type AdminUploadResult = {
  url: string;
  width?: number;
  height?: number;
};

type UploadConfig = {
  maxServerUploadBytes: number;
  cloudinaryDirectAvailable: boolean;
  maxDirectCloudinaryBytes: number;
};

let uploadConfigCache: UploadConfig | null = null;

async function readApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  try {
    const body = text ? (JSON.parse(text) as { error?: string }) : null;
    if (body?.error) return body.error;
  } catch {
    if (text) return `${fallback}: ${text.slice(0, 200)}`;
  }
  return `${fallback} (${res.status})`;
}

async function getUploadConfig(): Promise<UploadConfig> {
  if (uploadConfigCache) return uploadConfigCache;
  const res = await fetch("/api/upload-config", {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Could not load upload settings"));
  }
  uploadConfigCache = (await res.json()) as UploadConfig;
  return uploadConfigCache;
}

async function uploadViaCloudinaryDirect(
  file: File,
  folder: string,
): Promise<AdminUploadResult> {
  const signRes = await fetch("/api/upload-cloudinary-sign", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });
  if (!signRes.ok) {
    throw new Error(
      await readApiError(
        signRes,
        "Large upload needs Cloudinary (STORAGE_DRIVER=cloudinary and CLOUDINARY_* in .env)",
      ),
    );
  }
  const sig = (await signRes.json()) as {
    cloudName: string;
    apiKey: string;
    timestamp: string;
    signature: string;
    folder: string;
  };
  const cForm = new FormData();
  cForm.append("file", file);
  cForm.append("api_key", sig.apiKey);
  cForm.append("timestamp", sig.timestamp);
  cForm.append("signature", sig.signature);
  cForm.append("folder", sig.folder);
  const upRes = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: "POST", body: cForm },
  );
  if (!upRes.ok) {
    throw new Error(await readApiError(upRes, "Cloudinary upload failed"));
  }
  const data = (await upRes.json()) as {
    secure_url?: string;
    width?: number;
    height?: number;
  };
  if (!data.secure_url) throw new Error("Cloudinary returned no image URL");
  return {
    url: data.secure_url,
    width: data.width,
    height: data.height,
  };
}

async function uploadViaServer(
  file: File,
  folder: string,
): Promise<AdminUploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Image upload failed"));
  }
  const data = (await res.json()) as {
    url?: string;
    width?: number;
    height?: number;
  };
  if (!data.url) throw new Error("Upload failed: no image URL returned");
  return { url: data.url, width: data.width, height: data.height };
}

function mb(bytes: number) {
  return Math.round(bytes / (1024 * 1024));
}

/** Upload one image from admin (menu, gallery, banners). */
export async function uploadAdminImage(
  file: File,
  folder: string,
): Promise<AdminUploadResult> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) {
    throw new Error(
      "Unsupported file type. Use JPG, PNG, or WebP (convert HEIC to JPG on iPhone if needed).",
    );
  }

  const config = await getUploadConfig();
  const maxDirect = config.maxDirectCloudinaryBytes ?? MAX_DIRECT_CLOUDINARY_BYTES;

  if (file.size > maxDirect) {
    throw new Error(`Image is too large (max ${mb(maxDirect)}MB).`);
  }

  if (file.size > config.maxServerUploadBytes) {
    if (!config.cloudinaryDirectAvailable) {
      throw new Error(
        `Image is too large (${mb(file.size)}MB). Compress to under ${mb(config.maxServerUploadBytes)}MB, or set STORAGE_DRIVER=cloudinary and add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to .env (required on Vercel).`,
      );
    }
    return uploadViaCloudinaryDirect(file, folder);
  }

  return uploadViaServer(file, folder);
}
