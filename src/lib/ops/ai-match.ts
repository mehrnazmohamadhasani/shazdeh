import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { askWithSchema } from "./ai";
import { OpsError } from "./documents";
import { WEAK_MATCH, nameScore, rankIngredients } from "./ingredient-rank";

/*
 * Which stock ingredient each invoice line is (or none). Runs on its own
 * right after a document is read, for the stock lines the supplier's
 * memory and the name match couldn't link, and again from "Find matches
 * with AI" on the review. The person sees the pick and checks it before
 * saving. Lines with a clear match by name never go to the model.
 *
 * The model first says what each line is, in plain English, then names
 * the ingredient. A pick is kept when that description fits the
 * ingredient's name, or when the model repeats the ingredient's own name
 * with its label ("zipper bags" → "Zip bags"): a slip of the label
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
          required: ["line", "product", "ingredient", "ingredientName", "newName", "newNameFa"],
          properties: {
            line: { type: "string", enum: lineIds, description: "The line's label, e.g. L1." },
            product: { type: "string", description: "What this line is, in plain English, e.g. \"dried lime\", \"basmati rice\"." },
            ingredient: {
              anyOf: [{ type: "string", enum: ingredientIds }, { type: "null" }],
              description: "The label of the stock ingredient that is this same product, e.g. I4, or null if none is.",
            },
            ingredientName: {
              anyOf: [{ type: "string" }, { type: "null" }],
              description: "That ingredient's name exactly as listed (the part before the brackets), or null.",
            },
            newName: {
              anyOf: [{ type: "string" }, { type: "null" }],
              description: "Only when ingredient is null: a short, clean English stock name for this product, e.g. \"Paper towel roll\", \"Vinyl gloves\", \"Soup lid\" — no brand, size or pack.",
            },
            newNameFa: {
              anyOf: [{ type: "string" }, { type: "null" }],
              description: "Only when ingredient is null: the same name in Persian, e.g. \"دستمال رولی\".",
            },
          },
        },
      },
    },
  };
}

const INSTRUCTIONS = `You match lines from a restaurant supplier invoice (Dubai; English, Arabic or Persian, often handwritten or transliterated) to the restaurant's own stock ingredients.
Answer once for every line, using its label (L1, L2…). First write what the line is in plain English ("product"), then give the label (I1, I2…) of the stock ingredient that is that same product, or null.
Then repeat that ingredient's name exactly as listed ("ingredientName").
Same product means it would go into the same stock: spelling, language, brand, grade and pack size may differ ("Limon omani" = "dried limon", "برنج" = "rice", "St Oxo Bio Zipper Bags 28X22CM" = "Zip bags", "StKraft Soup Cups 12 Oz" = "Soup container", "Horeca Alum.foil 45CM" = "Aluminium foil"), but different products must not match (tomato paste is not tomato; egg plant is not egg; vinyl gloves are not latex gloves; lids are not the cups or bowls they close; dried lime is not lemon juice; two different rice varieties are different).
Each stock ingredient may list names it was already confirmed under on earlier invoices ("seen as"): a line printed the same or nearly the same way is that ingredient.
Stock names are the kitchen's own words, often naming what an item is used for: a takeaway cup can be listed by the drink it holds ("Sharbat cup"), a bowl by the dish ("Soup container"). Check for such an item before deciding none fits.
When unsure, answer null — a wrong match corrupts stock and food cost.
When the answer is null, give the new stock item a short, clean name in English and Persian (newName, newNameFa): what the kitchen would call it, without brand, size or pack ("St Maxi Roll 2Ply 800G" → "Paper towel roll" / "دستمال رولی"). Otherwise newName and newNameFa are null.`;

const EXACT_NAME = 0.95;
/** Earlier printed names shown per ingredient. */
const MAX_SEEN = 3;

type Stocked = { id: string; name: string; nameFa: string | null; unit: string };

/** What the AI made of a line: the stock ingredient, or a clean name for a new one. */
export type AiMatch = { key: string; ingredientId: string | null; newName?: { name: string; nameFa: string | null } | null };

/** The model's pick only when its own description of the line fits the ingredient (in any of its names). */
function fits(product: string, printed: string, ingredient: Stocked) {
  const names = [ingredient.name, ingredient.nameFa].filter((n): n is string => !!n);
  return names.some((n) => nameScore(product, n) >= WEAK_MATCH || nameScore(printed, n) >= WEAK_MATCH);
}

export async function matchLinesWithAi(documentId: string, lines: z.infer<typeof matchRequestSchema>["lines"]): Promise<AiMatch[]> {
  const [doc, ingredients, seen] = await Promise.all([
    prisma.opsDocument.findUnique({ where: { id: documentId }, select: { id: true } }),
    prisma.ingredient.findMany({ select: { id: true, name: true, nameFa: true, unit: true }, orderBy: { name: "asc" } }),
    // How each ingredient was printed on invoices people confirmed (any supplier): the model's memory.
    prisma.supplierItem.findMany({ select: { ingredientId: true, rawName: true }, orderBy: { updatedAt: "desc" }, take: 3000 }),
  ]);
  if (!doc) throw new OpsError("Document not found.", 404);
  if (!ingredients.length) return lines.map((l) => ({ key: l.key, ingredientId: null }));

  // Only a near-exact name skips the model: "Egg Plant" scores high against
  // "Egg" by its words, and now that picks are filled in on their own that
  // must be the model's call.
  const answers = new Map<string, string | null>();
  const fresh = new Map<string, { name: string; nameFa: string | null }>();
  const ask: typeof lines = [];
  for (const l of lines) {
    const best = rankIngredients(l.description, ingredients)[0];
    if (best && best.score >= EXACT_NAME) answers.set(l.key, best.item.id);
    else ask.push(l);
  }

  if (ask.length) {
    const lineId = (n: number) => `L${n + 1}`;
    const ingredientId = (n: number) => `I${n + 1}`;
    const seenAs = (id: string) => [...new Set(seen.filter((x) => x.ingredientId === id).map((x) => x.rawName.slice(0, 70)))].slice(0, MAX_SEEN);
    const stock = ingredients
      .map((i, n) => {
        const also = seenAs(i.id);
        return `${ingredientId(n)}: ${i.name}${i.nameFa ? ` (${i.nameFa})` : ""} — counted in ${i.unit.toLowerCase()}${also.length ? ` — seen as: ${also.map((a) => `"${a}"`).join("; ")}` : ""}`;
      })
      .join("\n");
    const printed = ask.map((l, n) => `${lineId(n)}: ${l.description}`).join("\n");
    const json = await askWithSchema({
      instructions: INSTRUCTIONS,
      prompt: `Stock ingredients:\n${stock}\n\nInvoice lines:\n${printed}`,
      schemaName: "ingredient_matches",
      jsonSchema: answerSchema(ask.map((_, n) => lineId(n)), ingredients.map((_, n) => ingredientId(n))),
      usage: { kind: "invoice", documentId },
    });
    const parsed = z
      .object({
        matches: z.array(
          z.object({
            line: z.string(),
            product: z.string(),
            ingredient: z.string().nullable(),
            ingredientName: z.string().nullable(),
            newName: z.string().nullable().optional(),
            newNameFa: z.string().nullable().optional(),
          }),
        ),
      })
      .safeParse(json);
    for (const m of parsed.success ? parsed.data.matches : []) {
      const line = ask[Number(m.line.slice(1)) - 1];
      if (!line) continue;
      const ingredient = m.ingredient ? ingredients[Number(m.ingredient.slice(1)) - 1] : undefined;
      const named = !!ingredient && !!m.ingredientName && [ingredient.name, ingredient.nameFa].some((n) => n && n.trim().toLowerCase() === m.ingredientName!.trim().toLowerCase());
      const pick = ingredient && (named || fits(m.product, line.description, ingredient)) ? ingredient.id : null;
      answers.set(line.key, pick);
      const name = m.newName?.trim().slice(0, 80);
      // A suggested name that is already a stock item's is that item, not a new one.
      const clash = name ? ingredients.find((i) => i.name.trim().toLowerCase() === name.toLowerCase()) : undefined;
      if (!pick && name && !clash) fresh.set(line.key, { name, nameFa: m.newNameFa?.trim().slice(0, 80) || null });
    }
  }
  return lines.map((l) => ({ key: l.key, ingredientId: answers.get(l.key) ?? null, newName: fresh.get(l.key) ?? null }));
}
