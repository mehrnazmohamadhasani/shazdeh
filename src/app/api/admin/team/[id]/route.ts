import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, requireAuth, serverError } from "@/lib/api";
import { setSessionCookie, signSession } from "@/lib/auth";
import { teamUpdateSchema } from "@/lib/ordering/admin-schemas";

async function adminCount() {
  return prisma.user.count({ where: { role: "ADMIN" } });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, teamUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  const { password, ...rest } = parsed.data;
  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (target.role === "ADMIN" && rest.role && rest.role !== "ADMIN" && (await adminCount()) <= 1) {
      return NextResponse.json({ error: "Keep at least one admin." }, { status: 409 });
    }
    // A new password signs this person out on every device.
    const { sessionVersion, ...user } = await prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(password ? { passwordHash: await bcrypt.hash(password, 12), sessionVersion: { increment: 1 } } : {}),
      },
      select: { id: true, email: true, name: true, role: true, sessionVersion: true },
    });
    // …except the admin changing their own password on this device.
    if (password && id === auth.user.id) await setSessionCookie(await signSession({ ...user, sessionVersion }));
    return ok(user);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  if (id === auth.user.id) return NextResponse.json({ error: "You can't remove yourself." }, { status: 409 });
  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (target?.role === "ADMIN" && (await adminCount()) <= 1) {
      return NextResponse.json({ error: "Keep at least one admin." }, { status: 409 });
    }
    await prisma.user.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
