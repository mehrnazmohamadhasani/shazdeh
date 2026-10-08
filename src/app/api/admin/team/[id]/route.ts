import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, requireAuth, serverError } from "@/lib/api";
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
    const user = await prisma.user.update({
      where: { id },
      data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
      select: { id: true, email: true, name: true, role: true },
    });
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
