import { test } from "node:test";
import assert from "node:assert/strict";
import { costVersion, dishMargin, grossQuantity, wouldCycle, type CostContext, type CostRecipe, type CostVersion } from "../recipe-cost";

/*
 * Recipe costing, with prices close to the real SHĀZDEH invoices
 * (brief §3.2): Fanoos sella rice 209.53 per 40 kg ≈ 0.524 fils/g, lamb
 * leg 40 AED/kg = 4 fils/g, beef 38 AED/kg = 3.8 fils/g.
 */

const ingredients = new Map<string, { name: string; filsPerUnit: number | null }>([
  ["rice", { name: "Sella rice", filsPerUnit: 20953 / 40000 }],
  ["lamb", { name: "Lamb leg", filsPerUnit: 4 }],
  ["beef", { name: "Beef", filsPerUnit: 3.8 }],
  ["herbs", { name: "Ghormeh herbs", filsPerUnit: 2 }],
  ["oil", { name: "Oil", filsPerUnit: 0.8 }],
  ["water", { name: "Water", filsPerUnit: null }],
]);

const v = (lines: CostVersion["lines"], over: Partial<CostVersion> = {}): CostVersion => ({ status: "APPROVED", yieldQuantity: 1, lines, ...over });
const ing = (id: string, quantity: number, wastePct = 0) => ({ ingredientId: id, subRecipeId: null, quantity, wastePct });
const prep = (id: string, quantity: number) => ({ ingredientId: null, subRecipeId: id, quantity, wastePct: 0 });

// Cooked rice: 2 kg raw rice + 100 ml oil → 5 kg cooked.
const cookedRice: CostRecipe = {
  id: "cooked-rice",
  name: "Cooked rice",
  approved: v([ing("rice", 2000), ing("oil", 100)], { yieldQuantity: 5000 }),
  draft: null,
};

function ctx(...recipes: CostRecipe[]): CostContext {
  return { recipes: new Map(recipes.map((r) => [r.id, r])), ingredients };
}

test("dish with a prep: cost per portion and verified", () => {
  const dish = v([prep("cooked-rice", 280), ing("lamb", 150), ing("herbs", 60, 25)]);
  const c = costVersion(dish, ctx(cookedRice));
  // rice per g cooked = (2000 × 0.523825 + 100 × 0.8) / 5000 = 0.22553
  const expected = 280 * 0.22553 + 150 * 4 + 80 * 2;
  assert.ok(Math.abs(c.totalFils - expected) < 1e-6, `${c.totalFils} vs ${expected}`);
  assert.equal(c.verified, true);
  assert.deepEqual(c.issues, []);
});

test("waste % raises the amount bought", () => {
  assert.equal(grossQuantity(150, 0), 150);
  assert.equal(grossQuantity(60, 25), 80);
});

test("missing price, draft version and draft prep make the cost estimated", () => {
  const draftRice: CostRecipe = { ...cookedRice, approved: null, draft: { ...cookedRice.approved!, status: "DRAFT" } };
  const dish = v([prep("cooked-rice", 280), ing("water", 200), ing("beef", 150)], { status: "DRAFT" });
  const c = costVersion(dish, ctx(draftRice));
  assert.equal(c.verified, false);
  assert.deepEqual(
    c.issues.map((i) => i.kind).sort(),
    ["draft", "draft_prep", "no_price"],
  );
  // The known lines still add up; the unknown one is left out, not guessed.
  assert.equal(c.lines[1].costFils, null);
  assert.ok(c.totalFils > 150 * 3.8);
});

test("a prep with no versions is flagged", () => {
  const empty: CostRecipe = { id: "tahdig", name: "Tahdig", approved: null, draft: null };
  const c = costVersion(v([prep("tahdig", 50)]), ctx(empty));
  assert.deepEqual(c.issues, [{ kind: "empty_prep", name: "Tahdig" }]);
});

test("cycles are detected, never looped", () => {
  const a: CostRecipe = { id: "a", name: "A", approved: v([prep("b", 10)], { yieldQuantity: 100 }), draft: null };
  const b: CostRecipe = { id: "b", name: "B", approved: v([prep("a", 10)], { yieldQuantity: 100 }), draft: null };
  const c = costVersion(a.approved!, ctx(a, b), ["a"]);
  assert.equal(c.verified, false);
  assert.ok(c.issues.some((i) => i.kind === "cycle"));

  const graph = new Map([
    ["base", { versions: [{ lines: [{ subRecipeId: "onion" }] }] }],
    ["onion", { versions: [{ lines: [{ subRecipeId: null }] }] }],
  ]);
  assert.equal(wouldCycle("onion", ["base"], graph), true);
  assert.equal(wouldCycle("dish", ["base"], graph), false);
});

test("food cost % on the ex-VAT menu price", () => {
  // Makaroni 98 AED incl. VAT → 93.33 ex VAT.
  const m = dishMargin(2800, 98);
  assert.equal(m.priceExVatFils, 9333);
  assert.equal(m.marginFils, 6533);
  assert.ok(Math.abs(m.foodCostPct! - 30.0) < 0.01);
});
