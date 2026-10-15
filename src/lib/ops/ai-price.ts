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
