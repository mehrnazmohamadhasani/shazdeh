import { test } from "node:test";
import assert from "node:assert/strict";
import { STRONG_MATCH, WEAK_MATCH, nameScore, nameTokens, rankIngredients } from "../ingredient-rank";

/*
 * Matching invoice lines (as printed or handwritten) to stock ingredients
 * for the review screen's picker.
 */

const stock = [
  { id: "rice-anj", name: "Rice (KG) Anjomam" },
  { id: "rice-sella", name: "Sella rice 1121" },
  { id: "lemon", name: "Lemon (juice)", nameFa: "لیمو" },
  { id: "limon", name: "dried limon" },
  { id: "onion", name: "Onion" },
  { id: "tomato", name: "TOMATO PASTE 800G" },
  { id: "ginger", name: "ginger barrel (pcs)" },
  { id: "barberries", name: "Barberries" },
];

test("pack words and amounts are ignored", () => {
  assert.deepEqual(nameTokens("ONION RED 10KG"), ["onion", "red"]);
  assert.deepEqual(nameTokens("Rice (KG) Anjomam"), ["rice", "anjomam"]);
});

test("the same name, printed differently, is a strong match", () => {
  assert.equal(nameScore("Rice (Kg) Anjomam", "Rice (KG) Anjomam"), 1);
  assert.ok(nameScore("ONION RED 10KG", "Onion") >= STRONG_MATCH);
  assert.ok(nameScore("Tomato paste 800 g", "TOMATO PASTE 800G") >= STRONG_MATCH);
});

test("handwritten spellings still find their ingredient", () => {
  assert.equal(rankIngredients("Ginger barvar (Pcs)", stock)[0].item.id, "ginger");
  assert.equal(rankIngredients("Dried Limon", stock)[0].item.id, "limon");
  assert.equal(rankIngredients("Rice (Kg) Anjomen", stock)[0].item.id, "rice-anj");
});

test("a word still being typed finds its ingredient", () => {
  assert.equal(rankIngredients("limo", [{ id: "lemon", name: "Lemon (juice)" }])[0]?.item.id, "lemon");
  assert.equal(rankIngredients("anjom", stock)[0]?.item.id, "rice-anj");
  // One letter off, but a different word.
  assert.ok(!rankIngredients("rice", [{ id: "onion", name: "Finely diced onion" }]).length);
});

test("a Persian name is compared too", () => {
  assert.equal(rankIngredients("ليمو", stock)[0]?.item.id, "lemon");
});

test("unrelated ingredients are left out", () => {
  const ranked = rankIngredients("Salt", stock);
  assert.ok(ranked.every((r) => r.score >= WEAK_MATCH));
  assert.ok(!ranked.some((r) => r.item.id === "barberries"));
});
