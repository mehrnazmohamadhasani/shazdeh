/*
 * JWT signing secret, shared by the auth helpers and the /admin proxy.
 *
 * In development a fixed fallback keeps local setup frictionless. In
 * production a missing AUTH_SECRET would mean every deployment signs
 * sessions with a publicly known key (anyone could forge an admin
 * cookie), so admin auth fails closed instead.
 */
const DEV_FALLBACK = "shazdeh-dev-secret-change-in-production-please";

let cached: Uint8Array | null | undefined;

export function getAuthSecret(): Uint8Array | null {
  if (cached !== undefined) return cached;
  const raw = process.env.AUTH_SECRET?.trim();
  if (raw && raw.length >= 32) {
    cached = new TextEncoder().encode(raw);
  } else if (process.env.NODE_ENV !== "production") {
    cached = new TextEncoder().encode(DEV_FALLBACK);
  } else {
    console.error(
      "[auth] AUTH_SECRET is missing or shorter than 32 characters — admin sign-in is disabled.",
    );
    cached = null;
  }
  return cached;
}

export const JWT_ISSUER = "shazdeh.ae";
export const JWT_AUDIENCE = "shazdeh.admin";
export const SESSION_COOKIE = "shazdeh_session";
