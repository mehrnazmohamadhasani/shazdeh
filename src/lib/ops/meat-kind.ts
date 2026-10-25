/*
 * Kinds of meat (lamb, beef, chicken, lamb shank): only a label on raw-meat
 * ingredients, which the invoice reading sets and a person can change.
 * Pure, so it can be tested and used on both server and client.
 */

const MEAT_WORDS = ["meat", "lamb", "mutton", "sheep", "beef", "veal", "calf", "chicken", "poultry", "shank", "گوشت", "گوسفند", "گوساله", "مرغ", "ماهیچه", "لحم", "خروف", "غنم", "عجل", "دجاج"];

/**
 * Whether an ingredient's name says it is meat ("Lamb leg", "FRESH MUTTON",
 * "گوشت گوساله"), so its page offers a kind of meat. Barberries, pepper,
 * rice… never do. `kinds` are the names of the kinds of meat.
 */
export function looksLikeMeat(names: (string | null | undefined)[], kinds: (string | null | undefined)[] = []) {
  const words = new Set([...MEAT_WORDS, ...kinds.flatMap((k) => (k ?? "").toLowerCase().split(/\s+/))].filter((w) => w.length >= 3));
  return names.some((n) =>
    (n ?? "")
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .some((w) => words.has(w) || [...words].some((m) => m.length >= 4 && w.startsWith(m))),
  );
}
