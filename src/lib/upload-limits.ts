/** Vercel serverless request body limit is ~4.5MB; multipart overhead needs margin. */
export const MAX_UPLOAD_BYTES_VERCEL = 3 * 1024 * 1024;

/** Local dev can accept larger bodies via `/api/upload`. */
export const MAX_UPLOAD_BYTES_LOCAL = 12 * 1024 * 1024;

/** @deprecated Prefer `/api/upload-config` on the client; use `getMaxServerUploadBytes()` on the server. */
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES_VERCEL;

/** Browser → Cloudinary direct upload (signed); keep reasonable to limit abuse. */
export const MAX_DIRECT_CLOUDINARY_BYTES = 20 * 1024 * 1024;

export function getMaxServerUploadBytes(): number {
  return process.env.VERCEL === "1"
    ? MAX_UPLOAD_BYTES_VERCEL
    : MAX_UPLOAD_BYTES_LOCAL;
}
