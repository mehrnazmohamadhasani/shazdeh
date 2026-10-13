import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/*
 * For uptime monitors: 200 when the app and its database answer, 503
 * when the database doesn't. Says nothing else about the system.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return NextResponse.json(
    { ok: db, db: db ? "up" : "down", version: process.env.NEXT_PUBLIC_APP_VERSION ?? null, ms: Date.now() - started },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
