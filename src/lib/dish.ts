/*
 * Dish view-model shared by server loaders and client components.
 * Kept free of server-only imports so client code can use the types.
 */

/** A dish's Arabic details, or null when it has none yet. */
export type DishArabicView = { name: string | null; description: string | null; ingredients: string | null; allergens: string | null };

/** Arabic portion words at the end of a name, e.g. "قورمه سبزي (كبير)". */
const ARABIC_PORTION = /\s*[(\-–—]?\s*(?:كبير|صغير|وسط|متوسط|عائلي)\s*\)?\s*$/;

export function arabicView(
  row: { nameAr: string | null; descriptionAr: string | null; ingredientsAr: string | null; allergensAr: string | null },
  stripPortion = false,
): DishArabicView | null {
  if (!row.nameAr && !row.descriptionAr && !row.ingredientsAr && !row.allergensAr) return null;
  return {
    name: row.nameAr && stripPortion ? row.nameAr.replace(ARABIC_PORTION, "").trim() || row.nameAr : row.nameAr,
    description: row.descriptionAr,
    ingredients: row.ingredientsAr,
    allergens: row.allergensAr,
  };
}

export type DishCardData = {
  id: string;
  slug: string;
  /** Raw name as stored, e.g. "Fesenjan Large" */
  name: string;
  /** Name without the portion suffix, e.g. "Fesenjan" */
  title: string;
  /** Portion size parsed from the stored name, e.g. "Large" */
  portion: string | null;
  nameFa?: string | null;
  description?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  arabic?: DishArabicView | null;
  price: number;
  imageUrl?: string | null;
  isVegetarian: boolean;
  isAvailable: boolean;
  category: { name: string; slug: string };
};

const PORTION = /\s*(?:[—–-]\s*)?\b(Small|Medium|Large|Regular|Family)$/i;

/** "Sabzi Khordan — Small" → { title: "Sabzi Khordan", portion: "Small" } */
export function splitPortion(name: string): {
  title: string;
  portion: string | null;
} {
  const match = name.match(PORTION);
  if (!match || match.index === undefined || match.index === 0) {
    return { title: name, portion: null };
  }
  const portion = match[1];
  return {
    title: name.slice(0, match.index).trim(),
    portion: portion[0].toUpperCase() + portion.slice(1).toLowerCase(),
  };
}

type DishRow = {
  id: string;
  slug: string;
  name: string;
  nameFa: string | null;
  description: string | null;
  ingredients: string | null;
  allergens: string | null;
  nameAr: string | null;
  descriptionAr: string | null;
  ingredientsAr: string | null;
  allergensAr: string | null;
  price: number;
  imageUrl: string | null;
  isVegetarian: boolean;
  isAvailable: boolean;
};

export function toDishCard(
  row: DishRow,
  category: { name: string; slug: string },
): DishCardData {
  const { title, portion } = splitPortion(row.name);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    title,
    portion,
    nameFa: row.nameFa,
    description: row.description,
    ingredients: row.ingredients,
    allergens: row.allergens,
    arabic: arabicView(row),
    price: row.price,
    imageUrl: row.imageUrl,
    isVegetarian: row.isVegetarian,
    isAvailable: row.isAvailable,
    category,
  };
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** 12 → "۱۲" — used for small bilingual numerals in editorial details. */
export function toPersianDigits(input: string | number) {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}
