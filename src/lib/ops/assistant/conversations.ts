import "server-only";
import { prisma } from "@/lib/prisma";
import { OpsError } from "../documents";
import { toCard } from "./actions";
import { conversationTitle } from "./model-format";
import type { ActionCard, ChatTurn } from "./types";

/*
 * Conversations with the assistant, kept per person so they can reopen
 * one of their latest or delete it. Only answered turns are stored (a
 * message that failed is retried from the screen). Deleting a
 * conversation removes its words only: the changes it suggested stay in
 * AssistantAction and the AuditLog.
 */

type User = { id: string; email: string; role: string };

/** How many conversations the screen lists. */
export const LISTED_CONVERSATIONS = 5;

export type ConversationSummary = { id: string; title: string; updatedAt: string; messages: number };
export type StoredMessage = { id: string; role: "user" | "assistant"; text: string; voice: boolean; cards: ActionCard[] };

/** The conversation, if it is this person's; anything else is "not found". */
async function own(id: string, user: User) {
  const c = await prisma.assistantConversation.findFirst({ where: { id, userId: user.id } });
  if (!c) throw new OpsError("Conversation not found.", 404);
  return c;
}

export async function listConversations(user: User): Promise<ConversationSummary[]> {
  const rows = await prisma.assistantConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: LISTED_CONVERSATIONS,
    select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString(), messages: r._count.messages }));
}

export async function getConversation(id: string, user: User) {
  const c = await own(id, user);
  const messages = await prisma.assistantMessage.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } });
  const actions = await prisma.assistantAction.findMany({ where: { id: { in: messages.flatMap((m) => m.actionIds) } } });
  return {
    id: c.id,
    title: c.title,
    messages: messages.map(
      (m): StoredMessage => ({
        id: m.id,
        role: m.role === "assistant" ? "assistant" : "user",
        text: m.text,
        voice: !!m.voiceDocumentId,
        cards: m.actionIds.flatMap((aid) => {
          const a = actions.find((x) => x.id === aid);
          return a ? [toCard(a, user)] : [];
        }),
      }),
    ),
  };
}

/** The latest turns for the model, with what became of the changes it suggested. */
export async function historyFor(id: string, user: User, turns: number): Promise<ChatTurn[]> {
  await own(id, user);
  const messages = (await prisma.assistantMessage.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" }, take: turns })).reverse();
  const actions = await prisma.assistantAction.findMany({ where: { id: { in: messages.flatMap((m) => m.actionIds) } }, select: { id: true, tool: true, status: true } });
  return messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    text: [
      m.text,
      ...m.actionIds.flatMap((aid) => {
        const a = actions.find((x) => x.id === aid);
        return a ? [`(Suggested change ${a.tool}: ${a.status === "PROPOSED" ? "not confirmed yet" : a.status.toLowerCase()})`] : [];
      }),
    ]
      .filter(Boolean)
      .join("\n"),
  }));
}

/** Stores one answered turn, starting the conversation if needed; returns its id. */
export async function saveTurn(
  user: User,
  conversationId: string | null,
  turn: { text: string; voiceDocumentId: string | null; reply: string; actionIds: string[] },
) {
  const id = conversationId ? (await own(conversationId, user)).id : (await prisma.assistantConversation.create({ data: { userId: user.id, title: conversationTitle(turn.text) } })).id;
  const now = Date.now();
  await prisma.$transaction([
    // Explicit times keep the question before the answer when both land in the same millisecond.
    prisma.assistantMessage.create({ data: { conversationId: id, role: "user", text: turn.text, voiceDocumentId: turn.voiceDocumentId, createdAt: new Date(now) } }),
    prisma.assistantMessage.create({ data: { conversationId: id, role: "assistant", text: turn.reply, actionIds: turn.actionIds, createdAt: new Date(now + 1) } }),
    prisma.assistantConversation.update({ where: { id }, data: { updatedAt: new Date(now + 1) } }),
  ]);
  return id;
}

export async function deleteConversation(id: string, user: User) {
  const c = await own(id, user);
  const messages = await prisma.assistantMessage.count({ where: { conversationId: id } });
  await prisma.$transaction([
    prisma.assistantConversation.delete({ where: { id } }),
    prisma.auditLog.create({
      data: { actor: user.email, action: "assistant.conversation.delete", entity: "AssistantConversation", entityId: id, before: { title: c.title, messages } },
    }),
  ]);
}
