import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { readWithSchema, AiNotConfiguredError } from "./ai";
import { AiBudgetError } from "./ai-usage";
import { OpsError } from "./documents";
import { recipeReadingJsonSchema, recipeReadingPrompt, recipeReadingSchema, sampleRecipeReading, type RecipeReading } from "./recipe-reading";
import { writeDraft } from "./recipes";
import { fitsUnit, newStockUnit, normalizeName } from "./units";
import { reportError } from "@/lib/report-error";

/*
 * Recipe sheets from a photo: the AI reads the page into a RecipeReading,
 * a person matches each line to an ingredient or prep on the import
 * screen, and the result is saved as a DRAFT of the chosen recipe (never
 * approved here). Confirmed names are remembered as RecipeNameAlias so
 * the next sheet that says "Parboiled rice" matches by itself.
 */

type Actor = { id: string; email: string };
type Unit = "G" | "ML" | "PCS";

/** What OpsDocument.extraction holds for a recipe photo. */
export type StoredRecipeReading = { recipe: RecipeReading };

export function parseStoredRecipe(value: unknown): RecipeReading | null {
  if (!value || typeof value !== "object") return null;
  const parsed = recipeReadingSchema.safeParse((value as { recipe?: unknown }).recipe);
  return parsed.success ? parsed.data : null;
}

/** Reads a recipe photo with AI. Never throws: failures are stored on the document. */
export async function processRecipeDocument(id: string) {
  const doc = await prisma.opsDocument.findUnique({ where: { id }, select: { data: true, mimeType: true, originalName: true } });
  if (!doc) return;
  await prisma.opsDocument.update({ where: { id }, data: { status: "PROCESSING", error: null } });
  try {
    let reading: RecipeReading;
    let meta: { model: string; inputTokens: number | null; outputTokens: number | null };
    if (!process.env.OPENAI_API_KEY?.trim()) {
      if (process.env.NODE_ENV === "production") throw new AiNotConfiguredError();
      reading = sampleRecipeReading();
      meta = { model: "sample (no OPENAI_API_KEY)", inputTokens: null, outputTokens: null };
    } else {
      const [ingredients, preps] = await Promise.all([
        prisma.ingredient.findMany({ where: { category: { not: "SUPPLIES" } }, select: { name: true }, orderBy: { name: "asc" } }),
        prisma.recipe.findMany({ where: { kind: "PREP" }, select: { name: true }, orderBy: { name: "asc" } }),
      ]);
      const result = await readWithSchema(
        { data: Buffer.from(doc.data), mimeType: doc.mimeType, name: doc.originalName },
        {
          instructions: recipeReadingPrompt({ ingredients: ingredients.map((i) => i.name), preps: preps.map((p) => p.name) }),
          prompt: "Read this recipe sheet.",
          schemaName: "recipe_sheet",
          jsonSchema: recipeReadingJsonSchema,
          usage: { kind: "recipe", documentId: id },
        },
      );
      const parsed = recipeReadingSchema.safeParse(result.json);
      if (!parsed.success) throw new Error(`The reading didn't match the expected shape: ${parsed.error.message.slice(0, 300)}`);
      reading = parsed.data;
      meta = { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
    }
    const stored: StoredRecipeReading = { recipe: reading };
    await prisma.opsDocument.update({
      where: { id },
      data: { status: "NEEDS_REVIEW", extraction: stored as unknown as Prisma.InputJsonValue, aiModel: meta.model, aiInputTokens: meta.inputTokens, aiOutputTokens: meta.outputTokens },
    });
  } catch (e) {
    if (!(e instanceof AiBudgetError)) await reportError(e, { where: `recipe photo read ${id}` });
    await prisma.opsDocument.update({
      where: { id },
      data: { status: "FAILED", error: (e instanceof Error ? e.message : String(e)).slice(0, 1000) },
    });
  }
}

// ─── Review screen ──────────────────────────────────────────────────────────

export type LineMatch = { type: "ingredient" | "prep"; id: string; via: "learned" | "name" } | null;

/**
 * The import screen's data: the reading, what each line most likely is
 * (a learned alias first, then the same name), and the likeliest recipe —
 * or, when the photo was added from a dish's page (`forDish`), that dish.
 */
export async function getRecipeImport(id: string, forDish?: string | null) {
  const doc = await prisma.opsDocument.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      status: true,
      createdAt: true,
      mimeType: true,
      extraction: true,
      aiModel: true,
      error: true,
      uploadedBy: { select: { email: true, name: true } },
      recipeVersions: { select: { recipeId: true }, take: 1 },
    },
  });
  if (!doc || doc.kind !== "recipe") return null;
  const reading = parseStoredRecipe(doc.extraction);

  const [ingredients, recipes, aliases, menuItems] = await Promise.all([
    prisma.ingredient.findMany({ where: { category: { not: "SUPPLIES" } }, select: { id: true, name: true, nameFa: true, unit: true }, orderBy: { name: "asc" } }),
    prisma.recipe.findMany({
      select: { id: true, kind: true, name: true, nameFa: true, menuItemId: true, versions: { select: { yieldUnit: true, status: true }, orderBy: { number: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
    }),
    prisma.recipeNameAlias.findMany(),
    prisma.menuItem.findMany({ where: { isActive: true }, select: { id: true, name: true, nameFa: true }, orderBy: [{ category: { order: "asc" } }, { order: "asc" }] }),
  ]);
  const preps = recipes.filter((r) => r.kind === "PREP").map((r) => ({ id: r.id, name: r.name, nameFa: r.nameFa, unit: (r.versions[0]?.yieldUnit ?? "G") as Unit }));

  const byName = (raw: string, nameFa: string | null): LineMatch => {
    const key = normalizeName(raw);
    const alias = aliases.find((a) => a.rawName === key);
    if (alias?.ingredientId) return { type: "ingredient", id: alias.ingredientId, via: "learned" };
    if (alias?.recipeId) return { type: "prep", id: alias.recipeId, via: "learned" };
    const same = (a: string | null) => !!a && (normalizeName(a) === key || (!!nameFa && normalizeName(a) === normalizeName(nameFa)));
    const prep = preps.find((p) => same(p.name) || same(p.nameFa));
    if (prep) return { type: "prep", id: prep.id, via: "name" };
    const ing = ingredients.find((i) => same(i.name) || same(i.nameFa));
    if (ing) return { type: "ingredient", id: ing.id, via: "name" };
    return null;
  };

  // The recipe this sheet is most likely for: a recipe or a menu dish whose name shares words with the title.
  let target: { type: "recipe"; id: string } | { type: "dish"; menuItemId: string } | null = null;
  if (reading) {
    const words = (t: string | null) => new Set(normalizeName(t ?? "").split(/[^a-z0-9؀-ۿ]+/).filter((w) => w.length > 2 && !["stew", "sop", "shazdeh", "with", "per", "portion", "final", "version"].includes(w)));
    const wanted = new Set([...words(reading.title), ...words(reading.otherNames)]);
    const score = (name: string, nameFa: string | null) => [...words(name), ...words(nameFa)].filter((w) => wanted.has(w)).length;
    const pool = [
      ...recipes.filter((r) => (reading.kind === "prep") === (r.kind === "PREP")).map((r) => ({ s: score(r.name, r.nameFa), t: { type: "recipe" as const, id: r.id } })),
      ...(reading.kind === "dish"
        ? menuItems.filter((m) => !recipes.some((r) => r.menuItemId === m.id)).map((m) => ({ s: score(m.name, m.nameFa), t: { type: "dish" as const, menuItemId: m.id } }))
        : []),
    ].sort((a, b) => b.s - a.s);
    if (pool[0]?.s) target = pool[0].t;
  }
  if (forDish && menuItems.some((m) => m.id === forDish)) {
    const own = recipes.find((r) => r.menuItemId === forDish);
    target = own ? { type: "recipe", id: own.id } : { type: "dish", menuItemId: forDish };
  }

  return {
    doc,
    reading,
    matches: reading ? reading.lines.map((l) => byName(l.name, l.nameFa)) : [],
    target,
    options: {
      ingredients: ingredients.map((i) => ({ id: i.id, name: i.name, nameFa: i.nameFa, unit: i.unit as Unit })),
      preps,
      recipes: recipes.map((r) => ({ id: r.id, kind: r.kind, name: r.name, nameFa: r.nameFa })),
      // Dishes still without a recipe.
      dishes: menuItems.filter((m) => !recipes.some((r) => r.menuItemId === m.id)),
    },
  };
}

// ─── Saving ─────────────────────────────────────────────────────────────────

export type ImportSource =
  | { type: "ingredient"; id: string }
  | { type: "prep"; id: string }
  | { type: "newIngredient"; name: string; nameFa: string | null; unit: Unit }
  | { type: "newPrep"; name: string; nameFa: string | null; unit: Unit };

export type ImportInput = {
  target: { type: "recipe"; recipeId: string } | { type: "dish"; menuItemId: string } | { type: "prep"; name: string; nameFa: string | null };
  /** Dish: the amounts below are for this many portions and are divided by it. */
  portions: number;
  /** Prep: what the amounts below make. */
  yieldQuantity: number;
  yieldUnit: Unit;
  method: string | null;
  lines: { rawName: string; source: ImportSource; quantity: number; wastePct: number; note: string | null }[];
};

/** A new prep starts as an empty draft so dishes can use it straight away (its cost shows as missing). */
async function createPrep(tx: Prisma.TransactionClient, name: string, nameFa: string | null, unit: Unit, actor: Actor) {
  const existing = await tx.recipe.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) {
    if (existing.kind !== "PREP") throw new OpsError(`"${existing.name}" is a dish recipe, not a prep.`, 409);
    return existing.id;
  }
  const created = await tx.recipe.create({
    data: {
      kind: "PREP",
      name,
      nameFa,
      versions: { create: { number: 1, status: "DRAFT", yieldQuantity: unit === "PCS" ? 1 : 1000, yieldUnit: newStockUnit(unit), createdById: actor.id } },
    },
  });
  await tx.auditLog.create({ data: { actor: actor.email, action: "recipe.create", entity: "Recipe", entityId: created.id, via: "photo", after: { kind: "PREP", name } } });
  return created.id;
}

export async function saveRecipeImport(documentId: string, input: ImportInput, actor: Actor) {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ status: string; kind: string }[]>`SELECT "status", "kind" FROM "OpsDocument" WHERE "id" = ${documentId} FOR UPDATE`;
      if (!rows[0] || rows[0].kind !== "recipe") throw new OpsError("Photo not found.", 404);
      if (rows[0].status !== "NEEDS_REVIEW") throw new OpsError("This photo was already saved or discarded.", 409);

      // 1. The recipe it goes into.
      let recipeId: string;
      if (input.target.type === "recipe") {
        const r = await tx.recipe.findUnique({ where: { id: input.target.recipeId }, select: { id: true } });
        if (!r) throw new OpsError("Recipe not found.", 404);
        recipeId = r.id;
      } else if (input.target.type === "dish") {
        const item = await tx.menuItem.findUnique({ where: { id: input.target.menuItemId }, include: { recipe: { select: { id: true } } } });
        if (!item) throw new OpsError("Dish not found.", 404);
        if (item.recipe) recipeId = item.recipe.id;
        else {
          const clash = await tx.recipe.findFirst({ where: { name: { equals: item.name, mode: "insensitive" } }, select: { id: true } });
          if (clash) throw new OpsError(`A recipe called "${item.name}" already exists.`, 409);
          const created = await tx.recipe.create({ data: { kind: "DISH", name: item.name, nameFa: item.nameFa, menuItemId: item.id } });
          await tx.auditLog.create({ data: { actor: actor.email, action: "recipe.create", entity: "Recipe", entityId: created.id, via: "photo", after: { kind: "DISH", name: item.name, menuItemId: item.id } } });
          recipeId = created.id;
        }
      } else {
        recipeId = await createPrep(tx, input.target.name, input.target.nameFa, input.yieldUnit, actor);
      }
      const recipe = await tx.recipe.findUniqueOrThrow({ where: { id: recipeId }, select: { kind: true } });

      // 2. Every line's ingredient or prep, creating new ones where asked.
      const lines: { ingredientId: string | null; subRecipeId: string | null; quantity: number; wastePct: number; note: string | null }[] = [];
      const divisor = recipe.kind === "DISH" ? input.portions : 1;
      for (const line of input.lines) {
        let ingredientId: string | null = null;
        let subRecipeId: string | null = null;
        const src = line.source;
        if (src.type === "ingredient") ingredientId = src.id;
        else if (src.type === "prep") subRecipeId = src.id;
        else if (src.type === "newIngredient") {
          const found = await tx.ingredient.findFirst({ where: { name: { equals: src.name, mode: "insensitive" } } });
          if (found && !fitsUnit(found.unit, src.unit)) throw new OpsError(`"${found.name}" already exists, counted in ${found.unit.toLowerCase()}.`, 409);
          ingredientId = found?.id ?? (await tx.ingredient.create({ data: { name: src.name, nameFa: src.nameFa, unit: newStockUnit(src.unit), category: "FOOD" } })).id;
        } else {
          subRecipeId = await createPrep(tx, src.name, src.nameFa, src.unit, actor);
        }
        lines.push({ ingredientId, subRecipeId, quantity: line.quantity / divisor, wastePct: line.wastePct, note: line.note });

        // 3. Remember what this name means for the next sheet.
        const rawName = normalizeName(line.rawName);
        if (rawName) {
          const data = { ingredientId, recipeId: subRecipeId };
          await tx.recipeNameAlias.upsert({ where: { rawName }, create: { rawName, ...data }, update: data });
        }
      }

      // 4. The draft (writeDraft checks sources and cycles), linked to the photo.
      await writeDraft(
        tx,
        recipeId,
        { yieldQuantity: input.yieldQuantity, yieldUnit: input.yieldUnit, note: "Read from a photo", method: input.method, lines },
        actor,
        { documentId, via: "photo" },
      );
      await tx.opsDocument.update({ where: { id: documentId }, data: { status: "SAVED" } });
      return { recipeId };
    },
    { timeout: 20_000 },
  );
}

/** Photos waiting on the recipes screen. */
export async function listRecipeDocuments() {
  return prisma.opsDocument.findMany({
    where: { kind: "recipe", status: { in: ["PROCESSING", "NEEDS_REVIEW", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true, extraction: true, error: true },
  });
}
