import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  SESSION_COOKIE,
  getAuthSecret,
} from "@/lib/auth-secret";
import { roleHome, roleMayOpen } from "@/lib/roles";

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

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The account behind this cookie no longer exists — forget it.
  if (pathname === "/login" && req.nextUrl.searchParams.has("signed-out")) {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

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

  // Kitchen staff see the order board only, the purchaser the purchasing
  // screens; the CMS stays with editors (src/lib/roles.ts).
  if (role && pathname.startsWith("/admin") && !roleMayOpen(role, pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = roleHome(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && role) {
    const url = req.nextUrl.clone();
    url.pathname = roleHome(role);
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
