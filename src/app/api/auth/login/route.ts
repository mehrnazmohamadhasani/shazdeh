import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, setSessionCookie, signSession } from "@/lib/auth";
import { getAuthSecret } from "@/lib/auth-secret";
import { clientIp, sharedRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/report-error";

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(6).max(200),
});

export async function POST(req: Request) {
  // Shared across all server instances (F-08).
  const limited = await sharedRateLimit(`login:ip:${clientIp(req)}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return tooManyAttempts(limited.retryAfterSeconds);

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

  // Per account too, so guesses spread over many IPs still hit a limit.
  const perAccount = await sharedRateLimit(`login:email:${parsed.data.email.trim().toLowerCase()}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!perAccount.ok) return tooManyAttempts(perAccount.retryAfterSeconds);

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

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    await reportError(e, { where: "login" });
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again." },
      { status: 500 },
    );
  }
}

function tooManyAttempts(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many sign-in attempts. Please wait a few minutes." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
