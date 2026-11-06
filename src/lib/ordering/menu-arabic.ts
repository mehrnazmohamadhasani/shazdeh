import "server-only";
import { prisma } from "@/lib/prisma";
import { askWithSchema } from "@/lib/ops/ai";

/*
 * Arabic for the menu: the UAE consumer protection regulation (Cabinet
 * Resolution 66/2023, Art. 40) asks online sellers to show a dish's
 * ingredients in Arabic as well. Staff can type it, or have AI draft it
 * from the English and correct it.
 */

export type DishText = { name: string; description: string | null; ingredients: string | null; allergens: string | null };
export type DishArabic = { nameAr: string | null; descriptionAr: string | null; ingredientsAr: string | null; allergensAr: string | null };

const INSTRUCTIONS = `You translate a Persian restaurant's menu in Dubai from English into Arabic (Modern Standard Arabic, as used on UAE menus).
- Dish names: write the Persian dish name in Arabic letters the way Arabic menus in the UAE write it (e.g. "Ghormeh Sabzi" → "قورمه سبزي"), and translate words such as Large, Small, with rice.
- Translate every field fully into Arabic, allergens included (e.g. "Contains: walnuts, dairy." → "يحتوي على: جوز، منتجات الألبان.").
- Translate only what is given. Never add, drop or guess ingredients or allergens: allergen information must stay exact.
- Keep numbers, weights and units as they are.
- When an English field is empty, return an empty string for it.`;

const FIELD = { type: "string" };
const ITEM = {
  type: "object",
  additionalProperties: false,
  required: ["nameAr", "descriptionAr", "ingredientsAr", "allergensAr"],
  properties: { nameAr: FIELD, descriptionAr: FIELD, ingredientsAr: FIELD, allergensAr: FIELD },
};
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dishes"],
  properties: { dishes: { type: "array", items: ITEM } },
};

/** The answer for one field, or null when it is empty or not actually Arabic (then staff write it). */
const orNull = (v: unknown) => (typeof v === "string" && /[\u0600-\u06FF]/.test(v) ? v.trim() : null);

/** Arabic drafts for these dishes, in the same order. */
export async function translateDishes(dishes: DishText[]): Promise<DishArabic[]> {
  if (dishes.length === 0) return [];
  const answer = (await askWithSchema({
    instructions: INSTRUCTIONS,
    prompt: `Translate each dish (same order, same count):\n${JSON.stringify(
      dishes.map((d) => ({ name: d.name, description: d.description ?? "", ingredients: d.ingredients ?? "", allergens: d.allergens ?? "" })),
    )}`,
    schemaName: "menu_arabic",
    jsonSchema: SCHEMA,
    usage: { kind: "translate" },
  })) as { dishes: Record<string, unknown>[] };
  if (answer.dishes.length !== dishes.length) throw new Error("The translation came back incomplete. Please try again.");
  // An Arabic field only where there is English to match it.
  return answer.dishes.map((a, i) => ({
    nameAr: orNull(a.nameAr),
    descriptionAr: dishes[i].description ? orNull(a.descriptionAr) : null,
    ingredientsAr: dishes[i].ingredients ? orNull(a.ingredientsAr) : null,
    allergensAr: dishes[i].allergens ? orNull(a.allergensAr) : null,
  }));
}

/** Per AI call, so one answer stays short and reliable. */
const BATCH = 10;

/**
 * Drafts Arabic for every dish that has none yet, and saves it. Fields
 * someone already wrote in Arabic are never overwritten.
 */
export async function fillMissingArabic(): Promise<{ filled: number }> {
  const missing = await prisma.menuItem.findMany({
    where: { nameAr: null },
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
    select: { id: true, name: true, description: true, ingredients: true, allergens: true, descriptionAr: true, ingredientsAr: true, allergensAr: true },
  });
  let filled = 0;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const arabic = await translateDishes(batch);
    for (const [j, dish] of batch.entries()) {
      const a = arabic[j];
      await prisma.menuItem.updateMany({
        where: { id: dish.id, nameAr: null },
        data: {
          nameAr: a.nameAr,
          descriptionAr: dish.descriptionAr ?? a.descriptionAr,
          ingredientsAr: dish.ingredientsAr ?? a.ingredientsAr,
          allergensAr: dish.allergensAr ?? a.allergensAr,
        },
      });
      filled++;
    }
  }
  return { filled };
}
