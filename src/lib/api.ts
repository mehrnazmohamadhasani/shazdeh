import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getSessionUser } from "@/lib/auth";

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, response: null };
}

export async function parseJson<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<
  { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: first
            ? `${first.path.join(".") || "Input"}: ${first.message}`
            : "Validation failed",
          issues: z.flattenError(parsed.error),
        },
        { status: 422 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Maps known database errors to meaningful statuses; everything else
 * is logged server-side and returned as a generic 500 so internals
 * (queries, hostnames, stack details) never reach the client.
 */
export function serverError(
  err: unknown,
  opts?: {
    /** Admin-only endpoints may surface actionable config messages. */
    expose?: boolean;
  },
) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = (err.meta?.target as string[] | string | undefined) ?? "";
        const field = Array.isArray(target) ? target.join(", ") : target;
        return NextResponse.json(
          {
            error: field
              ? `That ${field} is already in use.`
              : "That record already exists.",
          },
          { status: 409 },
        );
      }
      case "P2003":
        return NextResponse.json(
          { error: "A related record is missing or still in use." },
          { status: 409 },
        );
      case "P2025":
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  console.error(err);
  if (opts?.expose && err instanceof Error && err.message) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  return NextResponse.json(
    { error: "Something went wrong on our side. Please try again." },
    { status: 500 },
  );
}

/**
 * Public pages are statically regenerated; refresh them right after an
 * admin change instead of waiting for the revalidate window.
 */
export function revalidateSite() {
  try {
    revalidatePath("/", "layout");
  } catch (e) {
    console.error("[revalidate]", e);
  }
}
