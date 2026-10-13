import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  SESSION_COOKIE,
  getAuthSecret,
} from "@/lib/auth-secret";

const SESSION_DURATION_DAYS = 7;

// A real bcrypt hash (cost 12) of a random string. Comparing against it
// when the email is unknown keeps response time constant, so timing
// can't be used to discover which admin emails exist.
const TIMING_DUMMY_HASH =
  "$2b$12$QBwXyIi1cRKQb3FPqWQf2eVZKXOoEX708pv9CjNwgrX1QDpBYCa6K";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRoleValue;
};

export type UserRoleValue = "ADMIN" | "EDITOR" | "STAFF";

/** What the session cookie carries: the user plus the session version it was signed with. */
export type SessionClaims = SessionUser & { sessionVersion: number };

export async function signSession(user: SessionClaims): Promise<string> {
  const secret = getAuthSecret();
  if (!secret) throw new Error("Admin sign-in is not configured");
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sv: user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  const secret = getAuthSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });
    if (!payload.sub || !payload.email || !payload.role) return null;
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: (payload.name as string | null) ?? null,
      role: payload.role as UserRoleValue,
      // Tokens from before session versions existed count as version 0.
      sessionVersion: typeof payload.sv === "number" ? payload.sv : 0,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * The signed-in user, re-read from the database so a removed account, a
 * changed role or a changed password (session version) takes effect
 * immediately, not when the JWT expires. Null when signed out or stale.
 */
export async function currentUser(session: SessionClaims | null): Promise<SessionUser | null> {
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, role: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== session.sessionVersion) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Gate for admin pages. */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSessionUser();
  const user = await currentUser(session);
  // A valid token for a removed account or an old password: send them to
  // sign in and have the proxy drop the stale cookie (otherwise /login
  // would bounce straight back here).
  if (!user) redirect(session ? "/login?signed-out=1" : "/login");
  return user;
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionClaims | null> {
  // Emails are matched without regard to capital letters.
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
  });
  const ok = await bcrypt.compare(
    password,
    user?.passwordHash ?? TIMING_DUMMY_HASH,
  );
  if (!user || !ok) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DURATION_DAYS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
