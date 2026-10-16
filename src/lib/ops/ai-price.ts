/*
 * What an AI call costs, in millionths of a US dollar. Prices are per
 * million tokens and default to gpt-5-mini; set them in the environment
 * when the model or its price changes:
 *
 *   AI_PRICE_INPUT_PER_MTOK    default 0.25
 *   AI_PRICE_OUTPUT_PER_MTOK   default 2.00
 */

export type AiPrices = { inputPerMTok: number; outputPerMTok: number };

export function aiPrices(env: Record<string, string | undefined> = process.env): AiPrices {
  const read = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return v?.trim() && Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return { inputPerMTok: read(env.AI_PRICE_INPUT_PER_MTOK, 0.25), outputPerMTok: read(env.AI_PRICE_OUTPUT_PER_MTOK, 2) };
}

/*
 * Speech-to-text (gpt-4o-transcribe) is billed per token too, at its own
 * rates — audio in (about US$ 0.006 a minute), the vocabulary prompt in
 * as text, the transcript out:
 *
 *   AI_PRICE_VOICE_INPUT_PER_MTOK        audio in,  default 6.00
 *   AI_PRICE_VOICE_TEXT_INPUT_PER_MTOK   prompt in, default 2.50
 *   AI_PRICE_VOICE_OUTPUT_PER_MTOK       text out,  default 10.00
 */
export function voicePrices(env: Record<string, string | undefined> = process.env): AiPrices & { textInputPerMTok: number } {
  const audio = aiPrices({ AI_PRICE_INPUT_PER_MTOK: env.AI_PRICE_VOICE_INPUT_PER_MTOK ?? "6", AI_PRICE_OUTPUT_PER_MTOK: env.AI_PRICE_VOICE_OUTPUT_PER_MTOK ?? "10" });
  const text = aiPrices({ AI_PRICE_INPUT_PER_MTOK: env.AI_PRICE_VOICE_TEXT_INPUT_PER_MTOK ?? "2.5" });
  return { ...audio, textInputPerMTok: text.inputPerMTok };
}

/** One transcription: audio and prompt tokens in (each at its rate), text out. */
export function voiceCostMicroUsd(t: { audioTokens: number; textTokens: number; outputTokens: number }, p: ReturnType<typeof voicePrices>): number {
  return Math.round(t.audioTokens * p.inputPerMTok + t.textTokens * p.textInputPerMTok + t.outputTokens * p.outputPerMTok);
}

/** Models billed by the second (whisper-1): US$ 0.006 a minute = 100 micro-dollars a second. */
export function secondsCostMicroUsd(seconds: number): number {
  return Math.round(seconds * 100);
}

/** $ per million tokens × tokens = millionths of a dollar per token × tokens. */
export function aiCostMicroUsd(inputTokens: number, outputTokens: number, prices: AiPrices): number {
  return Math.round(inputTokens * prices.inputPerMTok + outputTokens * prices.outputPerMTok);
}

/** "2026-10" for the month a moment falls in, in Dubai (UTC+4, no DST). */
export function dubaiMonth(at: Date): string {
  return new Date(at.getTime() + 4 * 3_600_000).toISOString().slice(0, 7);
}

/** The first moment of that Dubai month, as a UTC Date. */
export function dubaiMonthStart(at: Date): Date {
  return new Date(`${dubaiMonth(at)}-01T00:00:00+04:00`);
}
