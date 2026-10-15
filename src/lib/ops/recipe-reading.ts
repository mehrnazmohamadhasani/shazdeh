import { z } from "zod";

/*
 * The one shape every photographed recipe sheet is read into — printed
 * SOPs with handwritten corrections, a page from a notebook, a chef's
 * scribbles. The AI fills it (./recipe-ai.ts); a person checks it on the
 * import screen and it becomes a recipe draft, never an approved recipe.
 */

export const RECIPE_UNITS = ["g", "ml", "pcs"] as const;

export const recipeReadingLineSchema = z.object({
  /** As written, in English where possible ("Boneless chicken"). */
  name: z.string(),
  /** Persian name if written or obvious ("مرغ بی‌استخوان"), else null. */
  nameFa: z.string().nullable(),
  /** The amount exactly as on the paper, corrections included: "200 g → 375 (handwritten)". */
  printed: z.string(),
  /** Amount for the whole sheet in g / ml / pcs, after handwritten corrections. */
  quantity: z.number().nullable(),
  unit: z.enum(RECIPE_UNITS).nullable(),
  /** The amount was converted from tbsp / tsp / cloves / "1/4 medium" etc. — a guess to check. */
  estimated: z.boolean(),
  /** The line or its amount was added or changed by hand. */
  handwritten: z.boolean(),
  /** Made in the kitchen from other ingredients (parboiled rice, fried onion, yogurt sauce…). */
  isPrep: z.boolean(),
  confidence: z.number().min(0).max(1),
  note: z.string().nullable(),
});

export const recipeReadingSchema = z.object({
  /** The dish or prep name as printed, e.g. "Chicken & Eggplant". */
  title: z.string().nullable(),
  /** Other names on the page, e.g. a handwritten "Morgh" at the top. */
  otherNames: z.string().nullable(),
  kind: z.enum(["dish", "prep"]),
  /** How many portions the amounts are for: "per portion" = 1, "All 4 portion" = 4. Null for a prep made by the batch. */
  portions: z.number().nullable(),
  /** What the sheet makes, if stated: "Final weight ≈ 820 g", "per 1 shank". */
  yieldQuantity: z.number().nullable(),
  yieldUnit: z.enum(RECIPE_UNITS).nullable(),
  lines: z.array(recipeReadingLineSchema),
  /** Steps, timings, oven settings, quality and serving notes as plain text. */
  method: z.string().nullable(),
  /** Handwritten notes that are not a clear ingredient line. */
  handwrittenNotes: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type RecipeReading = z.infer<typeof recipeReadingSchema>;
export type RecipeReadingLine = z.infer<typeof recipeReadingLineSchema>;

const n = { type: ["number", "null"] };
const s = { type: ["string", "null"] };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const unit = { type: ["string", "null"], enum: [...RECIPE_UNITS, null] };

export const recipeReadingJsonSchema = obj({
  title: s,
  otherNames: s,
  kind: { type: "string", enum: ["dish", "prep"] },
  portions: n,
  yieldQuantity: n,
  yieldUnit: unit,
  lines: {
    type: "array",
    items: obj({
      name: { type: "string" },
      nameFa: s,
      printed: { type: "string" },
      quantity: n,
      unit,
      estimated: { type: "boolean" },
      handwritten: { type: "boolean" },
      isPrep: { type: "boolean" },
      confidence: { type: "number" },
      note: s,
    }),
  },
  method: s,
  handwrittenNotes: s,
  confidence: { type: "number" },
});

export function recipeReadingPrompt(known: { ingredients: string[]; preps: string[] }) {
  return `You read recipe sheets for SHĀZDEH, a Persian restaurant / cloud kitchen in Dubai.
The photo is usually a printed "SHAZDEH SOP" page (ingredients table, steps, quality notes) that the chef has corrected by hand in pen: amounts crossed out and rewritten, lines added in the margin, notes at the bottom. It may also be fully handwritten, in English, Persian or Arabic, photographed at an angle with glare.

The handwritten corrections are the CURRENT recipe. When a printed amount is crossed out and a new one is written next to it, use the handwritten value. When a sum is written ("1 g + 1 = 2 g", "15 g + 5 = 20 g"), use the result. Handwritten additions in the margin that name an ingredient and an amount ("50 – onion", "Celery 30 g", "+10 lemon", "Fresh tomato +30 gram") are extra lines. Mark every such line handwritten = true and explain what changed in note. If a crossed-out value can't be read, say so in note; if the new value can't be read, quantity = null.

Rules:
- One line per ingredient actually used, in the order on the sheet, including garnish. Do NOT make lines for specifications that are not ingredients (e.g. "Eggplant slice thickness 1–1.5 cm", oven settings, mould size) — put those in method.
- quantity / unit: the amount for the WHOLE sheet in "g" (solids, also spices, butter, pastes), "ml" (thin liquids like water, rose water, lemon juice, oil if written in ml) or "pcs" (counted things: pieces, eggs, cinnamon sticks, rose buds, shanks). Convert kg → g and L → ml. When written in grams, keep grams even for liquids ("30 g oil" = 30 g). "120 g (60 + 60)" is 120.
- Kitchen measures: convert with ordinary values and set estimated = true: 1 tbsp ≈ 15 g (tomato paste ≈ 16 g, salt ≈ 18 g), 1 tsp ≈ 5 g (salt ≈ 6 g), 1 garlic clove ≈ 5 g, a medium onion ≈ 150 g, "1/4 piece dried lime" = 0.25 pcs, "1/3 pc carrot" = 0.33 pcs. If an amount has no sensible conversion ("water 2× shank height", "to taste"), quantity = null and explain in note.
- portions: 1 when the sheet says "per portion" or the amounts are clearly for one plate; the number written when it says e.g. "All 4 portion" or "for 10 portions"; null for a base made by the batch.
- kind: "dish" for a plate that is served; "prep" for something made in advance and used in dishes (lamb shank, stew base, saffron rice, fried eggplant, sauces). A sheet for one component "per 1 shank" or "per batch" is a prep.
- isPrep on a line: true for things the kitchen makes itself from other ingredients — semi-prepared herbs, parboiled rice, saffron rice, yogurt sauce, fried eggplant, fried onion, tomato sauce, chicken stock, brewed saffron, lamb shank; false for bought ingredients (raw chicken, salt, spices, oil, tomato paste, split peas).
- yieldQuantity / yieldUnit: what the sheet makes when stated ("Final weight ≈ 820 g" → 820 g, "Ingredients (per 1 shank)" → 1 pcs, "total stew output ≈ 300 g" → 300 g), else null.
- Use these existing names when an item is clearly the same thing, so it matches what the kitchen already stocks:
  Ingredients: ${known.ingredients.slice(0, 300).join("; ") || "(none yet)"}
  Preps: ${known.preps.slice(0, 200).join("; ") || "(none yet)"}
- nameFa: the Persian name if written, or the usual Persian name of a common item (e.g. زعفران, زردچوبه, رب گوجه); null if unsure.
- method: the steps, timings, oven settings, quality-control and serving notes, concise but complete, one step per line. Include handwritten instructions ("Chicken cook only 30 minutes", "Boil 30 minutes").
- handwrittenNotes: any handwritten text you could not turn into a line or a step, copied as written.
- confidence (0–1) per line and overall; lower it for messy handwriting, crossed-out values and guesses.`;
}

/** Development only (no OPENAI_API_KEY): a reading of the Gheimeh SOP sheet. */
export function sampleRecipeReading(): RecipeReading {
  const line = (name: string, printed: string, quantity: number | null, unit: "g" | "ml" | "pcs" | null, extra: Partial<RecipeReadingLine> = {}): RecipeReadingLine => ({
    name,
    nameFa: null,
    printed,
    quantity,
    unit,
    estimated: false,
    handwritten: false,
    isPrep: false,
    confidence: 0.92,
    note: null,
    ...extra,
  });
  return {
    title: "Gheimeh Stew",
    otherNames: null,
    kind: "dish",
    portions: 1,
    yieldQuantity: 330,
    yieldUnit: "g",
    lines: [
      line("Split peas (dry)", "60 g", 60, "g"),
      line("Onion", "50 g", 50, "g"),
      line("Dried lime", "1/4 piece", 0.25, "pcs", { estimated: true }),
      line("Salt", "3 g", 3, "g"),
      line("Turmeric", "0.5 g", 0.5, "g"),
      line("Red pepper", "0.2 g (Black crossed out, 'Red' written)", 0.2, "g", { handwritten: true, note: "Black pepper changed to red pepper by hand." }),
      line("Oil", "20 g → 350 (handwritten)", 350, "g", { handwritten: true, confidence: 0.6, note: "350 is written next to the crossed-out 20 g — check whether this is per batch." }),
      line("Tomato paste", "30 g", 30, "g"),
      line("Brewed saffron", "0.3 g", 0.3, "g", { isPrep: true }),
      line("Fried eggplant", "50 g", 50, "g", { isPrep: true }),
      line("Lamb shank", "+ Lamb shank (handwritten)", 1, "pcs", { handwritten: true, isPrep: true, confidence: 0.7 }),
    ],
    method: "Soak split peas 2–3 hours.\nSauté onion with oil 8 minutes until golden.\nAdd turmeric and salt, 1 minute.\nAdd tomato paste, 3 minutes.\nAdd split peas and 300 g water, cook on low heat 40 minutes.\nFinish with cardamom, cinnamon, saffron, rose water and dried lime; rest 10 minutes.\nServe with 50 g fried eggplant on top.",
    handwrittenNotes: "Butter",
    confidence: 0.8,
  };
}
