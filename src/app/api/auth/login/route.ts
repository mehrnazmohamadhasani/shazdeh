import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, setSessionCookie, signSession } from "@/lib/auth";
import { getAuthSecret } from "@/lib/auth-secret";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(6).max(200),
});

export async function POST(req: Request) {
  const limited = rateLimit(`login:${clientIp(req)}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please wait a few minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

  if (!getAuthSecret()) {
    return NextResponse.json(
      { error: "Admin sign-in is not configured on this deployment." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and password." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const token = await signSession(user);
    await setSessionCookie(token);

    return NextResponse.json({ user });
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again." },
      { status: 500 },
    );
  }
}
