import crypto from "node:crypto";

/** Cloudinary signed upload — shared by API route and server storage. */
export function cloudinaryUploadSignature(
  folderPath: string,
  timestamp: string,
  apiSecret: string,
): string {
  const sigParams = `folder=${folderPath}&timestamp=${timestamp}${apiSecret}`;
  return crypto.createHash("sha1").update(sigParams).digest("hex");
}
