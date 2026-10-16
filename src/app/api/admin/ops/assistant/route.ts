import { NextResponse } from "next/server";
import { z } from "zod";
import { PURCHASING_ROLES, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { opsError } from "@/lib/ops/http";
import { sharedRateLimit } from "@/lib/rate-limit";
import { getAdminLocale } from "@/lib/admin-i18n/server";
import { HISTORY_TURNS, runAssistant } from "@/lib/ops/assistant/agent";
import { historyFor, saveTurn } from "@/lib/ops/assistant/conversations";
import { ownVoiceNote } from "@/lib/ops/assistant/voice";

export const runtime = "nodejs";
// The model and its tool calls run inside this request.
export const maxDuration = 120;

const schema = z.object({
  text: z.string().trim().min(1).max(2000),
  /** The conversation this continues; null starts a new one. */
  conversationId: z.string().max(40).nullable().default(null),
  /** The voice note this text was transcribed from (and checked by the person), if any. */
  voiceDocumentId: z.string().max(40).nullable().default(null),
});

/**
 * One message to the assistant: its answer, a card for each change it
 * suggests, and the conversation it was saved in. Earlier turns come from
 * the stored conversation, not from the browser.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(PURCHASING_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const limited = await sharedRateLimit(`assistant:${auth.user.id}`, { limit: 40, windowMs: 10 * 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "Too many messages. Wait a minute and try again." }, { status: 429 });
  try {
    // A conversation deleted meanwhile (another tab) simply starts a new one.
    const asked = parsed.data.conversationId;
    const conversationId = asked && (await prisma.assistantConversation.count({ where: { id: asked, userId: auth.user.id } })) ? asked : null;
    const sourceDocumentId = await ownVoiceNote(parsed.data.voiceDocumentId, auth.user.id);
    const result = await runAssistant({
      user: auth.user,
      history: conversationId ? await historyFor(conversationId, auth.user, HISTORY_TURNS) : [],
      text: parsed.data.text,
      via: sourceDocumentId ? "voice" : "chat",
      sourceDocumentId,
      locale: await getAdminLocale(),
    });
    const saved = await saveTurn(auth.user, conversationId, {
      text: parsed.data.text,
      voiceDocumentId: sourceDocumentId,
      reply: result.reply,
      actionIds: result.cards.map((c) => c.id),
    });
    return ok({ ...result, conversationId: saved });
  } catch (e) {
    return opsError(e);
  }
}
