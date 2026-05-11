/** Vercel serverless request body limit is ~4.5MB; multipart overhead needs margin. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

/** Browser → Cloudinary direct upload (signed); keep reasonable to limit abuse. */
export const MAX_DIRECT_CLOUDINARY_BYTES = 20 * 1024 * 1024;
