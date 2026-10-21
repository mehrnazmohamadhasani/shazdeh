import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { askWithSchema } from "./ai";
import { OpsError } from "./documents";
import { STRONG_MATCH, WEAK_MATCH, nameScore, rankIngredients } from "./ingredient-rank";

/*
 * "Find matches with AI" on the invoice review: for lines the picker
 * couldn't link, ask the model which stock ingredient each one is (or
 * none). Only a suggestion — the person taps "Use" to apply it. Lines
 * with a clear match by name never go to the model.
 *
 * The model first says what each line is, in plain English, and a pick
 * is kept only when that description fits the ingredient's name: a slip
 * ("dried limon" → "ginger barrel") is dropped, not suggested.
 */

export const matchRequestSchema = z.object({
  lines: z.array(z.object({ key: z.string().min(1).max(40), description: z.string().trim().min(1).max(300) })).min(1).max(80),
});

/**
 * Lines and ingredients go to the model as labels (L1…, I1…) and must come
 * back as one of them, enforced by the schema: an answer can't name an
 * ingredient that isn't in stock.
 */
function answerSchema(lineIds: string[], ingredientIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["matches"],
    properties: {
      matches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["line", "product", "ingredient"],
          properties: {
            line: { type: "string", enum: lineIds, description: "The line's label, e.g. L1." },
            product: { type: "string", description: "What this line is, in plain English, e.g. \"dried lime\", \"basmati rice\"." },
            ingredient: {
              anyOf: [{ type: "string", enum: ingredientIds }, { type: "null" }],
              description: "The label of the stock ingredient that is this same product, e.g. I4, or null if none is.",
            },
          },
        },
      },
    },
  };
}

const INSTRUCTIONS = `You match lines from a restaurant supplier invoice (Dubai; English, Arabic or Persian, often handwritten or transliterated) to the restaurant's own stock ingredients.
Answer once for every line, using its label (L1, L2…). First write what the line is in plain English ("product"), then give the label (I1, I2…) of the stock ingredient that is that same product, or null.
Same product means it would go into the same stock: spelling, language, brand, grade and pack size may differ ("Limon omani" = "dried limon", "برنج" = "rice"), but different products must not match (tomato paste is not tomato; dried lime is not lemon juice; two different rice varieties are different).
When unsure, answer null — a wrong match corrupts stock and food cost.`;

type Stocked = { id: string; name: string; nameFa: string | null; unit: string };

/** The model's pick only when its own description of the line fits the ingredient (in any of its names). */
function fits(product: string, printed: string, ingredient: Stocked) {
  const names = [ingredient.name, ingredient.nameFa].filter((n): n is string => !!n);
  return names.some((n) => nameScore(product, n) >= WEAK_MATCH || nameScore(printed, n) >= WEAK_MATCH);
}

export async function matchLinesWithAi(documentId: string, lines: z.infer<typeof matchRequestSchema>["lines"]) {
  const [doc, ingredients] = await Promise.all([
    prisma.opsDocument.findUnique({ where: { id: documentId }, select: { id: true } }),
    prisma.ingredient.findMany({ select: { id: true, name: true, nameFa: true, unit: true }, orderBy: { name: "asc" } }),
  ]);
  if (!doc) throw new OpsError("Document not found.", 404);
  if (!ingredients.length) return lines.map((l) => ({ key: l.key, ingredientId: null }));

  // A clear match by name needs no model.
  const answers = new Map<string, string | null>();
  const ask: typeof lines = [];
  for (const l of lines) {
    const best = rankIngredients(l.description, ingredients)[0];
    if (best && best.score >= STRONG_MATCH) answers.set(l.key, best.item.id);
    else ask.push(l);
  }

  if (ask.length) {
    const lineId = (n: number) => `L${n + 1}`;
    const ingredientId = (n: number) => `I${n + 1}`;
    const stock = ingredients.map((i, n) => `${ingredientId(n)}: ${i.name}${i.nameFa ? ` (${i.nameFa})` : ""} — counted in ${i.unit.toLowerCase()}`).join("\n");
    const printed = ask.map((l, n) => `${lineId(n)}: ${l.description}`).join("\n");
    const json = await askWithSchema({
      instructions: INSTRUCTIONS,
      prompt: `Stock ingredients:\n${stock}\n\nInvoice lines:\n${printed}`,
      schemaName: "ingredient_matches",
      jsonSchema: answerSchema(ask.map((_, n) => lineId(n)), ingredients.map((_, n) => ingredientId(n))),
      usage: { kind: "invoice", documentId },
    });
    const parsed = z
      .object({ matches: z.array(z.object({ line: z.string(), product: z.string(), ingredient: z.string().nullable() })) })
      .safeParse(json);
    for (const m of parsed.success ? parsed.data.matches : []) {
      const line = ask[Number(m.line.slice(1)) - 1];
      if (!line) continue;
      const ingredient = m.ingredient ? ingredients[Number(m.ingredient.slice(1)) - 1] : undefined;
      answers.set(line.key, ingredient && fits(m.product, line.description, ingredient) ? ingredient.id : null);
    }
  }
  return lines.map((l) => ({ key: l.key, ingredientId: answers.get(l.key) ?? null }));
}
