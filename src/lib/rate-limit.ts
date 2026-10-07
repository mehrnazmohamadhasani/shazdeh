import "server-only";

/*
 * Minimal fixed-window rate limiter for sensitive endpoints (sign-in).
 *
 * State lives in process memory, so on serverless it is per-instance:
 * it blunts casual brute-forcing but is not a substitute for an edge
 * or Redis-backed limiter if the admin is ever exposed to real abuse.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Opportunistic cleanup keeps the map bounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Client IP for rate-limit keys. Prefers x-real-ip (set by Vercel and
 * most reverse proxies), then the right-most x-forwarded-for hop — the
 * one appended by our own proxy — since left-most values are
 * client-controlled and trivially rotated.
 */
export function clientIp(req: Request) {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = req.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return hops?.at(-1) ?? "unknown";
}
