import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/report-error";
import { AiNotConfiguredError } from "../ai";
import { assertAiBudget, recordAiUsage } from "../ai-usage";
import { secondsCostMicroUsd, voiceCostMicroUsd, voicePrices } from "../ai-price";
import { OpsError } from "../documents";

/*
 * Voice notes: kept like any other source document (OpsDocument, kind
 * "voice_note", the audio itself immutable and sha256-deduped) and turned
 * into text the person can check and fix before it is sent.
 *
 * One provider today — OpenAI speech-to-text — behind transcribe(), so
 * another (e.g. ElevenLabs Scribe) can be swapped in here only:
 *
 *   OPENAI_TRANSCRIBE_MODEL   optional, default gpt-4o-transcribe
 *
 * The prompt carries SHĀZDEH's own words — dish, prep, ingredient and
 * supplier names in English and Persian — so "قرمه سبزی" or "Rasti Lari"
 * come out spelled the way the kitchen spells them.
 */

export const MAX_VOICE_BYTES = 4 * 1024 * 1024;
const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac", "audio/x-m4a", "audio/m4a"];
const EXTENSION: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/aac": "aac", "audio/x-m4a": "m4a", "audio/m4a": "m4a" };

/** "audio/webm;codecs=opus" → "audio/webm", or null when it isn't audio we take. */
export function audioType(mime: string): string | null {
  const base = mime.split(";")[0].trim().toLowerCase();
  return AUDIO_TYPES.includes(base) ? base : null;
}

const VOCAB_CHARS = 1600;

/** Names the kitchen uses, most specific first, cut to what the prompt can take. */
async function vocabulary(): Promise<string> {
  const [recipes, ingredients, suppliers] = await Promise.all([
    prisma.recipe.findMany({ select: { name: true, nameFa: true } }),
    prisma.ingredient.findMany({ where: { movements: { some: {} } }, select: { name: true, nameFa: true } }),
    prisma.supplier.findMany({ select: { name: true }, take: 40 }),
  ]);
  const words: string[] = [];
  for (const r of [...recipes, ...ingredients]) {
    words.push(r.name);
    if (r.nameFa) words.push(r.nameFa);
  }
  words.push(...suppliers.map((s) => s.name));
  let out = "";
  for (const w of [...new Set(words)]) {
    if (out.length + w.length + 2 > VOCAB_CHARS) break;
    out += (out ? ", " : "") + w;
  }
  return out;
}

type Transcript = { text: string; model: string; inputTokens: number | null; outputTokens: number | null; costMicroUsd: number };

async function transcribe(file: { data: Buffer; mimeType: string }): Promise<Transcript> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new AiNotConfiguredError();
  await assertAiBudget();
  const model = process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-transcribe";
  const words = await vocabulary();
  const form = new FormData();
  form.append("model", model);
  form.append("file", new Blob([new Uint8Array(file.data)], { type: file.mimeType }), `voice.${EXTENSION[file.mimeType] ?? "webm"}`);
  form.append("response_format", "json");
  // No language is set: Persian, English and Arabic are all spoken here.
  form.append(
    "prompt",
    `A busy restaurant kitchen (SHĀZDEH, Persian food, Dubai) talking about stock, purchases, waste, recipes and prices, in Persian, English or Arabic, often mixed. Amounts in grams, kilos, litres and dirhams. Names used here: ${words}.`,
  );
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    text?: string;
    usage?: {
      type?: string;
      input_tokens?: number;
      output_tokens?: number;
      seconds?: number;
      input_token_details?: { audio_tokens?: number; text_tokens?: number };
    };
  };
  const u = body.usage;
  // Without a split, every input token is priced as audio: never under-counted.
  const audioTokens = u?.input_token_details?.audio_tokens ?? u?.input_tokens ?? 0;
  const textTokens = u?.input_token_details ? (u.input_token_details.text_tokens ?? 0) : 0;
  const costMicroUsd =
    u?.type === "duration" && u.seconds != null
      ? secondsCostMicroUsd(u.seconds)
      : voiceCostMicroUsd({ audioTokens, textTokens, outputTokens: u?.output_tokens ?? 0 }, voicePrices());
  return { text: (body.text ?? "").trim(), model, inputTokens: u?.input_tokens ?? null, outputTokens: u?.output_tokens ?? null, costMicroUsd };
}

/**
 * Stores a voice note and returns what was said. The same recording sent
 * twice is stored once and not paid for again.
 */
export async function voiceNote(file: { data: Buffer; mimeType: string }, user: { id: string; email: string }) {
  const mimeType = audioType(file.mimeType);
  if (!mimeType) throw new OpsError("That recording format isn't supported.", 415);
  if (file.data.length === 0) throw new OpsError("The recording is empty.");
  if (file.data.length > MAX_VOICE_BYTES) throw new OpsError("The recording is too long. Keep voice notes under a minute.", 413);

  const sha256 = createHash("sha256").update(file.data).digest("hex");
  const existing = await prisma.opsDocument.findUnique({ where: { sha256 }, select: { id: true, kind: true, status: true, extraction: true } });
  if (existing?.kind === "voice_note" && existing.status === "SAVED") {
    return { documentId: existing.id, text: (existing.extraction as { transcript?: string } | null)?.transcript ?? "" };
  }
  if (existing && existing.kind !== "voice_note") throw new OpsError("This file is already stored as another document.", 409);
  const doc =
    existing ??
    (await prisma.opsDocument.create({
      data: { kind: "voice_note", status: "PROCESSING", sha256, mimeType, sizeBytes: file.data.length, data: new Uint8Array(file.data), uploadedById: user.id },
      select: { id: true },
    }));
  if (!existing) {
    await prisma.auditLog.create({ data: { actor: user.email, action: "document.upload", entity: "OpsDocument", entityId: doc.id, via: "voice", after: { kind: "voice_note", sizeBytes: file.data.length } } });
  }

  let t: Transcript;
  try {
    t = await transcribe({ data: file.data, mimeType });
  } catch (e) {
    await prisma.opsDocument.update({ where: { id: doc.id }, data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 500) : "Failed" } });
    if (!(e instanceof OpsError)) reportError(e, { where: "voice transcription" });
    throw e;
  }
  await recordAiUsage({ kind: "voice", model: t.model, inputTokens: t.inputTokens, outputTokens: t.outputTokens, documentId: doc.id, costMicroUsd: t.costMicroUsd });
  await prisma.opsDocument.update({
    where: { id: doc.id },
    data: { status: "SAVED", error: null, extraction: { transcript: t.text }, aiModel: t.model, aiInputTokens: t.inputTokens, aiOutputTokens: t.outputTokens },
  });
  return { documentId: doc.id, text: t.text };
}

/** The voice note an assistant message came from — only this person's, only a voice note. */
export async function ownVoiceNote(documentId: string | null | undefined, userId: string) {
  if (!documentId) return null;
  const doc = await prisma.opsDocument.findFirst({ where: { id: documentId, kind: "voice_note", uploadedById: userId }, select: { id: true } });
  return doc?.id ?? null;
}
