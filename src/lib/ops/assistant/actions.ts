import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { OpsError } from "../documents";
import { mayUse } from "./definitions";
import { apply, build, preview, undo, type ApplyResult, type StoredInput } from "./write-tools";
import type { Catalog } from "./catalog";
import { UNDO_WINDOW_MS, type ActionCard, type Preview, type WriteTool } from "./types";

/*
 * Proposals the assistant makes, and what a person does with them:
 * confirm (twice for sensitive ones), cancel, or undo within a day.
 * Each step is claimed with a conditional update first, so a double tap
 * or two phones can't apply or undo the same change twice.
 */

type User = { id: string; email: string; role: string };
type Row = Awaited<ReturnType<typeof prisma.assistantAction.findUniqueOrThrow>>;

export function toCard(row: Row, user: User, now = new Date()): ActionCard {
  return {
    id: row.id,
    tool: row.tool as WriteTool,
    status: row.status,
    sensitive: row.sensitive,
    via: row.via === "voice" ? "voice" : "chat",
    preview: row.preview as unknown as Preview,
    createdAt: row.createdAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
    canUndo:
      row.status === "APPLIED" &&
      !!row.appliedAt &&
      now.getTime() - row.appliedAt.getTime() < UNDO_WINDOW_MS &&
      (row.userId === user.id || user.role === "ADMIN") &&
      mayUse(user.role, row.tool),
  };
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** The model asked for a change: check it, work out the preview, store it as a proposal. */
export async function propose(
  tool: WriteTool,
  args: unknown,
  ctx: { user: User; via: "chat" | "voice"; sourceDocumentId: string | null; catalog: Catalog; today: string },
) {
  const input = await build(tool, args, ctx.catalog, ctx.user, ctx.today);
  const { preview: p, sensitive } = await preview(input);
  const row = await prisma.assistantAction.create({
    // The tool the input turned into (a change to a dish with no recipe is its first recipe).
    data: { userId: ctx.user.id, tool: input.tool, via: ctx.via, sensitive, input: json(input), preview: json(p), sourceDocumentId: ctx.sourceDocumentId },
  });
  return toCard(row, ctx.user);
}

async function load(id: string, user: User) {
  const row = await prisma.assistantAction.findUnique({ where: { id } });
  // Someone else's proposal is not theirs to act on (the owner may undo anything).
  if (!row || (row.userId !== user.id && user.role !== "ADMIN")) throw new OpsError("Not found.", 404);
  if (!mayUse(user.role, row.tool)) throw new OpsError("Your role can't make this change.", 403);
  return row;
}

/**
 * Applies a proposal. The preview is worked out again from the data as
 * it is now (and stored, so the card shows what was applied); a proposal
 * that can no longer apply fails here with the reason.
 */
export async function confirmAction(id: string, user: User, sure: boolean) {
  const row = await load(id, user);
  if (row.status !== "PROPOSED") throw new OpsError(row.status === "APPLIED" ? "This change is already done." : "This suggestion was closed.", 409);
  if (row.sensitive && !sure) throw new OpsError("This change needs a second confirmation.", 400, { needsSure: true });
  const input = row.input as unknown as StoredInput;
  const fresh = await preview(input);

  const claimed = await prisma.assistantAction.updateMany({
    where: { id, status: "PROPOSED" },
    data: { status: "APPLIED", appliedAt: new Date(), preview: json(fresh.preview) },
  });
  if (claimed.count === 0) throw new OpsError("This change is already done.", 409);
  let result: ApplyResult;
  try {
    result = await apply(input, user, row.via, row.sourceDocumentId);
  } catch (e) {
    await prisma.assistantAction.update({ where: { id }, data: { status: "PROPOSED", appliedAt: null } });
    throw e;
  }
  const [saved] = await prisma.$transaction([
    prisma.assistantAction.update({ where: { id }, data: { result: json(result) } }),
    prisma.auditLog.create({
      data: {
        actor: user.email,
        action: "assistant.confirm",
        entity: "AssistantAction",
        entityId: id,
        via: row.via,
        after: json({ tool: row.tool, sourceDocumentId: row.sourceDocumentId, result }),
      },
    }),
  ]);
  return toCard(saved, user);
}

export async function cancelAction(id: string, user: User) {
  await load(id, user);
  const done = await prisma.assistantAction.updateMany({ where: { id, status: "PROPOSED" }, data: { status: "CANCELLED" } });
  if (done.count === 0) throw new OpsError("This suggestion was already closed.", 409);
  return toCard(await prisma.assistantAction.findUniqueOrThrow({ where: { id } }), user);
}

export async function undoAction(id: string, user: User) {
  const row = await load(id, user);
  if (!toCard(row, user).canUndo) throw new OpsError(row.status === "UNDONE" ? "Already undone." : "This change can no longer be undone here.", 409);
  const claimed = await prisma.assistantAction.updateMany({ where: { id, status: "APPLIED" }, data: { status: "UNDONE", undoneAt: new Date() } });
  if (claimed.count === 0) throw new OpsError("Already undone.", 409);
  try {
    await undo(row.tool as WriteTool, row.result as unknown as ApplyResult, user, row.via);
  } catch (e) {
    await prisma.assistantAction.update({ where: { id }, data: { status: "APPLIED", undoneAt: null } });
    throw e;
  }
  const [saved] = await prisma.$transaction([
    prisma.assistantAction.findUniqueOrThrow({ where: { id } }),
    prisma.auditLog.create({
      data: { actor: user.email, action: "assistant.undo", entity: "AssistantAction", entityId: id, via: row.via, before: json({ tool: row.tool, result: row.result }) },
    }),
  ]);
  return toCard(saved, user);
}

/** This person's latest changes (proposed, done or undone), newest first. */
export async function recentActions(user: User, take = 15) {
  const rows = await prisma.assistantAction.findMany({
    where: { userId: user.id, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => toCard(r, user));
}
