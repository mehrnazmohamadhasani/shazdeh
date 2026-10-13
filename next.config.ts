import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * Identifies this build to the service worker (/sw.js?v=…): a new value
 * installs a new worker with fresh caches. The commit SHA on Vercel or a
 * git checkout; otherwise the build time.
 */
function appVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return Date.now().toString(36);
  }
}

const isDev = process.env.NODE_ENV === "development";

/*
 * Content-Security-Policy without nonces, so pages stay static and
 * cached (nonces would force every page to render per request). Inline
 * scripts stay allowed — Next's bootstrap needs them — but everything
 * else is locked to this site plus the image/video hosts we use:
 * Cloudinary and Supabase storage. Admin uploads go straight to
 * Cloudinary from the browser.
 */
const MEDIA_HOSTS = "https://res.cloudinary.com https://*.supabase.co";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${MEDIA_HOSTS}`,
  `media-src 'self' blob: ${MEDIA_HOSTS}`,
  "font-src 'self' data:",
  `connect-src 'self' https://api.cloudinary.com${isDev ? " ws:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'self'",
  // The invoice page shows the uploaded PDF (served by this site) in an <object>.
  "object-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion(),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Supabase storage
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Cloudinary
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    // SHĀZDEH is delivery-only: "contact" lives with the delivery-apps page.
    return [{ source: "/contact", destination: "/order/apps", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // HTTPS only, for two years (not in local development over http).
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
      {
        // The worker must always be revalidated, or a deploy could be
        // stuck behind a cached copy of the old one.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        // API responses are live or personal (orders, sessions, quotes):
        // never let a browser, proxy or CDN keep a copy.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
