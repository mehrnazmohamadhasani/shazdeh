import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { currentUser, getSessionUser, type SessionUser, type UserRoleValue } from "@/lib/auth";

/** Who may edit content. Kitchen staff (STAFF) only manage orders. */
export const CMS_ROLES: UserRoleValue[] = ["ADMIN", "EDITOR"];
export const ORDER_ROLES: UserRoleValue[] = ["ADMIN", "EDITOR", "STAFF"];

/**
 * Verifies the session JWT *and* re-reads the user, so a removed
 * account or a changed role takes effect immediately instead of when
 * the 7-day token expires.
 */
export async function requireAuth(
  roles: UserRoleValue[] = CMS_ROLES,
): Promise<
  | { user: SessionUser; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await currentUser(await getSessionUser());
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!roles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
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
/**
 * The field(s) behind a unique-constraint error (P2002). Prisma 7 driver
 * adapters don't fill `meta.target`; the constraint is on the adapter's
 * error instead.
 */
export function uniqueViolationFields(err: Prisma.PrismaClientKnownRequestError): string {
  const target = err.meta?.target as string[] | string | undefined;
  if (target) return Array.isArray(target) ? target.join(", ") : target;
  const constraint = (err.meta?.driverAdapterError as { cause?: { constraint?: { fields?: string[]; index?: string } } } | undefined)
    ?.cause?.constraint;
  return constraint?.fields?.join(", ") ?? constraint?.index ?? "";
}

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
        const field = uniqueViolationFields(err);
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
