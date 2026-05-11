import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "shazdeh_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ??
    "shazdeh-dev-secret-change-in-production-please",
);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
    try {
      await jwtVerify(token, secret, {
        issuer: "shazdeh.ae",
        audience: "shazdeh.admin",
      });
    } catch {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/login") {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      try {
        await jwtVerify(token, secret, {
          issuer: "shazdeh.ae",
          audience: "shazdeh.admin",
        });
        const url = req.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      } catch {
        // bad token; let the login page render
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
