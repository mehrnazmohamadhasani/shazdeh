import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  SESSION_COOKIE,
  getAuthSecret,
} from "@/lib/auth-secret";

/** Role from a valid session cookie, or null. */
async function sessionRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = getAuthSecret();
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });
    return String(payload.role ?? "");
  } catch {
    return null;
  }
}

// Kitchen staff see the order board only; the CMS stays with editors.
const STAFF_PATHS = ["/admin/orders"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const role =
    pathname.startsWith("/admin") || pathname === "/login"
      ? await sessionRole(req)
      : null;

  if (pathname.startsWith("/admin") && !role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (
    role === "STAFF" &&
    pathname.startsWith("/admin") &&
    !STAFF_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/orders";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && role) {
    const url = req.nextUrl.clone();
    url.pathname = role === "STAFF" ? "/admin/orders" : "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Lets the admin layout enforce roles from the database per page.
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
