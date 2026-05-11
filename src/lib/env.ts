import { z } from "zod";

/** Strip whitespace; empty string → undefined (avoids bad Cloudinary keys from copy/paste). */
function envTrim(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters")
    .default("shazdeh-dev-secret-change-in-production-please"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "supabase", "cloudinary"]).default("local"),
  // Supabase storage
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().optional(),
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  SUPABASE_BUCKET: process.env.SUPABASE_BUCKET,
  CLOUDINARY_CLOUD_NAME: envTrim(process.env.CLOUDINARY_CLOUD_NAME),
  CLOUDINARY_API_KEY: envTrim(process.env.CLOUDINARY_API_KEY),
  CLOUDINARY_API_SECRET: envTrim(process.env.CLOUDINARY_API_SECRET),
});
