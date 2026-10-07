/*
 * Dish view-model shared by server loaders and client components.
 * Kept free of server-only imports so client code can use the types.
 */

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
  story?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  price: number;
  currency: string;
  imageUrl?: string | null;
  spicyLevel: number;
  isVegetarian: boolean;
  isBestseller: boolean;
  isNew: boolean;
  isSignature: boolean;
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

export function spiceLabel(level: number) {
  if (level >= 3) return "Hot";
  if (level >= 2) return "Medium heat";
  if (level >= 1) return "Mild";
  return null;
}

type DishRow = {
  id: string;
  slug: string;
  name: string;
  nameFa: string | null;
  description: string | null;
  story: string | null;
  ingredients: string | null;
  allergens: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  spicyLevel: number;
  isVegetarian: boolean;
  isBestseller: boolean;
  isNew: boolean;
  isSignature: boolean;
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
    story: row.story,
    ingredients: row.ingredients,
    allergens: row.allergens,
    price: row.price,
    currency: row.currency,
    imageUrl: row.imageUrl,
    spicyLevel: row.spicyLevel,
    isVegetarian: row.isVegetarian,
    isBestseller: row.isBestseller,
    isNew: row.isNew,
    isSignature: row.isSignature,
    isAvailable: row.isAvailable,
    category,
  };
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** 12 → "۱۲" — used for small bilingual numerals in editorial details. */
export function toPersianDigits(input: string | number) {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}
