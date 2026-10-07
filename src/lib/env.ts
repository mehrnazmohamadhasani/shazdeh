import { z } from "zod";

/** Strip whitespace; empty string → undefined (avoids bad Cloudinary keys from copy/paste). */
function envTrim(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

/**
 * Canonical site origin for metadata, sitemap and JSON-LD. Falls back
 * to Vercel's production domain so canonicals never point at localhost
 * on a deployment where NEXT_PUBLIC_SITE_URL was forgotten.
 */
function siteUrl() {
  const explicit = envTrim(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;
  const vercel = envTrim(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  // Validated (length, production presence) in lib/auth-secret.ts so a
  // short secret disables admin sign-in instead of crashing the site.
  AUTH_SECRET: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.url(),
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "supabase", "cloudinary"]).default("local"),
  // Supabase storage
  SUPABASE_URL: z.url().optional(),
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
  NEXT_PUBLIC_SITE_URL: siteUrl(),
  ADMIN_EMAIL: envTrim(process.env.ADMIN_EMAIL),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  STORAGE_DRIVER: envTrim(process.env.STORAGE_DRIVER),
  SUPABASE_URL: envTrim(process.env.SUPABASE_URL),
  SUPABASE_SERVICE_KEY: envTrim(process.env.SUPABASE_SERVICE_KEY),
  SUPABASE_BUCKET: envTrim(process.env.SUPABASE_BUCKET),
  CLOUDINARY_CLOUD_NAME: envTrim(process.env.CLOUDINARY_CLOUD_NAME),
  CLOUDINARY_API_KEY: envTrim(process.env.CLOUDINARY_API_KEY),
  CLOUDINARY_API_SECRET: envTrim(process.env.CLOUDINARY_API_SECRET),
});
