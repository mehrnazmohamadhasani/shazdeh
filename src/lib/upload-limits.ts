/** Vercel serverless request body limit is ~4.5MB; multipart overhead needs margin. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
