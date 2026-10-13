import "server-only";
import { prisma } from "@/lib/prisma";

/*
 * Fixed-window rate limiters.
 *
 * rateLimit(): in process memory, so on serverless it is per-instance.
 * Cheap — used for high-frequency public reads (quotes, order tracking).
 *
 * sharedRateLimit(): counters in Postgres, shared by every instance —
 * used where the limit must really hold (sign-in, placing orders, push
 * registration). Costs one small write per request.
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

const WINDOW_SQL_MAX_MS = 24 * 3600_000;

/**
 * Like rateLimit(), but the counter lives in the database so the limit
 * holds across all server instances. The window is measured with the
 * database clock. If the database can't be reached the request is let
 * through (and logged): availability over strictness.
 */
export async function sharedRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const ms = Math.min(Math.max(Math.round(windowMs), 1000), WINDOW_SQL_MAX_MS);
  try {
    // One atomic statement: start a new window if the old one ended,
    // otherwise count this request in the current one.
    const rows = await prisma.$queryRaw<{ count: number; retry: number }[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
      VALUES (${key}, 1, (now() AT TIME ZONE 'UTC') + ${ms} * interval '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
      RETURNING "count", CEIL(EXTRACT(EPOCH FROM ("resetAt" - (now() AT TIME ZONE 'UTC'))))::int AS "retry"`;
    // Now and then, drop windows that ended over a day ago.
    if (Math.random() < 0.01) {
      prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "resetAt" < (now() AT TIME ZONE 'UTC') - interval '1 day'`.catch(() => {});
    }
    const row = rows[0];
    if (row && row.count > limit) return { ok: false, retryAfterSeconds: Math.max(1, row.retry) };
    return { ok: true, retryAfterSeconds: 0 };
  } catch (e) {
    console.error("[rate-limit] shared limiter unavailable", e);
    return { ok: true, retryAfterSeconds: 0 };
  }
}
