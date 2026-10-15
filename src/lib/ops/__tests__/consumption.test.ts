import { test } from "node:test";
import assert from "node:assert/strict";
import { dishUse, type ApprovedRecipe } from "../consumption";

/*
 * What selling a dish takes out of stock: approved recipes only, preps
 * opened up into raw ingredients, trim waste added back.
 */

const recipes = new Map<string, ApprovedRecipe>([
  // Cooked rice: 2,000 g raw rice + 40 g oil makes 5,000 g.
  ["rice", { id: "rice", name: "Cooked rice", approved: { versionId: "rice-v1", yieldQuantity: 5000, lines: [
    { ingredientId: "raw-rice", subRecipeId: null, quantity: 2000, wastePct: 0 },
    { ingredientId: "oil", subRecipeId: null, quantity: 40, wastePct: 0 },
  ] } }],
  // Ghormeh Sabzi, one portion: 280 g cooked rice, 150 g lamb, 80 g herbs (20 % trim).
  ["ghormeh", { id: "ghormeh", name: "Ghormeh Sabzi", approved: { versionId: "ghormeh-v2", yieldQuantity: 1, lines: [
    { ingredientId: null, subRecipeId: "rice", quantity: 280, wastePct: 0 },
    { ingredientId: "lamb", subRecipeId: null, quantity: 150, wastePct: 0 },
    { ingredientId: "herbs", subRecipeId: null, quantity: 80, wastePct: 20 },
  ] } }],
  ["draft-only", { id: "draft-only", name: "Fesenjan", approved: null }],
  ["uses-draft-prep", { id: "uses-draft-prep", name: "Tahchin", approved: { versionId: "t-v1", yieldQuantity: 1, lines: [
    { ingredientId: null, subRecipeId: "draft-only", quantity: 100, wastePct: 0 },
  ] } }],
]);

test("two portions: preps opened up, waste added back", () => {
  const use = dishUse(recipes.get("ghormeh"), 2, recipes);
  assert.ok(use.ok);
  if (!use.ok) return;
  assert.equal(use.versionId, "ghormeh-v2");
  assert.deepEqual(Object.fromEntries([...use.ingredients].map(([k, v]) => [k, Math.round(v * 10) / 10])), {
    "raw-rice": 224, // 560 g cooked rice × 2000/5000
    oil: 4.5, // 560 × 40/5000 = 4.48
    lamb: 300,
    herbs: 200, // 160 g used ÷ (1 − 20 %)
  });
});

test("no approved recipe: nothing is taken, the reason is given", () => {
  assert.deepEqual(dishUse(undefined, 1, recipes), { ok: false, reason: "no_recipe" });
  assert.deepEqual(dishUse(recipes.get("draft-only"), 1, recipes), { ok: false, reason: "not_approved" });
  assert.deepEqual(dishUse(recipes.get("uses-draft-prep"), 1, recipes), { ok: false, reason: "prep_not_approved", detail: "Fesenjan" });
});

test("a recipe that contains itself is refused", () => {
  const loop = new Map<string, ApprovedRecipe>([
    ["a", { id: "a", name: "A", approved: { versionId: "a1", yieldQuantity: 1, lines: [{ ingredientId: null, subRecipeId: "b", quantity: 1, wastePct: 0 }] } }],
    ["b", { id: "b", name: "B", approved: { versionId: "b1", yieldQuantity: 1, lines: [{ ingredientId: null, subRecipeId: "a", quantity: 1, wastePct: 0 }] } }],
  ]);
  assert.deepEqual(dishUse(loop.get("a"), 1, loop), { ok: false, reason: "cycle" });
});
