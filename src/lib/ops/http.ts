import "server-only";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/api";
import { OpsError } from "./documents";

/** OpsError → its status and message; anything else → a generic 500. */
export function opsError(e: unknown) {
  if (e instanceof OpsError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
  return serverError(e, { expose: true });
}
