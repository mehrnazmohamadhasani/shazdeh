/*
 * What the model is shown. Money is stored and computed in fils, but the
 * model is handed AED already divided: in testing it turned 3000 fils
 * into "AED 0.30". Every `…Fils` field becomes `…Aed` (up to 4 decimals,
 * so a prep's cost per gram survives); null stays null ("unknown").
 */

export function filsToAed(fils: number): number {
  return Number((fils / 100).toFixed(4));
}

export function moneyForModel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(moneyForModel);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) =>
        k.endsWith("Fils") && (typeof v === "number" || v === null) ? [`${k.slice(0, -4)}Aed`, v == null ? null : filsToAed(v)] : [k, moneyForModel(v)],
      ),
    );
  }
  return value;
}

/** Fils per g / ml / pc → AED per kg / litre / piece, the way a kitchen says prices. */
export function pricePerBigUnit(filsPerUnit: number, unit: "G" | "ML" | "PCS") {
  return unit === "PCS" ? { aed: filsToAed(filsPerUnit), per: "piece" } : { aed: filsToAed(filsPerUnit * 1000), per: unit === "G" ? "kg" : "litre" };
}

/**
 * The language to answer in, from the person's latest message: Arabic
 * script with Persian-only letters (پ چ ژ گ) or Persian ی/ک is Persian;
 * Arabic script with Arabic-only forms (ة ي ك, or none of the Persian
 * letters) is Arabic; mostly Latin letters is English. Said to the model plainly,
 * because left to itself it drifted into Persian on English questions.
 */
export function replyLanguage(text: string): "Persian" | "Arabic" | "English" {
  const arabicScript = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (latin >= arabicScript) return "English";
  if (/[پچژگ]/.test(text)) return "Persian";
  if (/[ةيك]/.test(text)) return "Arabic";
  return /[یک]/.test(text) ? "Persian" : "Arabic";
}

/** A conversation's name in the list: the first thing said, on one line, shortened. */
export function conversationTitle(text: string, max = 60): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}
