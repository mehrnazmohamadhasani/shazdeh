import { test } from "node:test";
import assert from "node:assert/strict";
import { aiLevel, creditDue, dishCostFrom, estimateProfit, exVat, lowStock, type DishCost, type ProfitSale } from "../profit";

/*
 * Today's estimated profit: only orders whose every dish has an approved
 * cost and whose fees are known count; the rest is reported, never zero.
 */

const costs = new Map<string, DishCost>([
  ["ghormeh", { ok: true, perPortionFils: 1200 }],
  ["kabab", { ok: true, perPortionFils: 1800.4 }],
  ["fesenjan", { ok: false, reason: "not_approved" }],
]);

const web = (food: number, items: ProfitSale["items"]): ProfitSale => ({ channel: "direct", foodSalesFils: food, items, feesFils: 0 });

test("website order with approved recipes: ex-VAT sales minus food cost", () => {
  const p = estimateProfit([web(10500, [{ menuItemId: "ghormeh", name: "Ghormeh", quantity: 2 }])], costs);
  assert.equal(p.salesFils, 10500);
  assert.deepEqual(p.covered, { orders: 1, salesFils: 10500, salesExVatFils: 10000, foodCostFils: 2400, feesFils: 0, profitFils: 7600 });
  assert.deepEqual(p.gaps, []);
});

test("platform fees count when a rule exists", () => {
  const p = estimateProfit([{ channel: "talabat", foodSalesFils: 5250, items: [{ menuItemId: "kabab", name: "Kabab", quantity: 1 }], feesFils: 1000 }], costs);
  assert.equal(p.covered.profitFils, 5000 - 1800 - 1000);
});

test("no fee rule: order left out, reported as fees unknown", () => {
  const p = estimateProfit(
    [
      web(10500, [{ menuItemId: "ghormeh", name: "Ghormeh", quantity: 1 }]),
      { channel: "careem", foodSalesFils: 4200, items: [{ menuItemId: "ghormeh", name: "Ghormeh", quantity: 1 }], feesFils: null },
      { channel: "careem", foodSalesFils: 3000, items: [{ menuItemId: "kabab", name: "Kabab", quantity: 1 }], feesFils: null },
    ],
    costs,
  );
  assert.equal(p.salesFils, 17700);
  assert.equal(p.covered.orders, 1);
  assert.equal(p.covered.salesFils, 10500);
  assert.deepEqual(p.gaps, [{ kind: "fees_unknown", channel: "careem", orders: 2, salesFils: 7200 }]);
});

test("one dish without an approved recipe keeps the whole order out", () => {
  const p = estimateProfit(
    [
      web(21000, [
        { menuItemId: "ghormeh", name: "Ghormeh", quantity: 1 },
        { menuItemId: "fesenjan", name: "Fesenjan", quantity: 2 },
      ]),
      web(5000, [{ menuItemId: "fesenjan", name: "Fesenjan", quantity: 1 }]),
      web(4000, [{ menuItemId: "unknown-dish", name: "Tahchin", quantity: 1 }]),
      web(3000, [{ menuItemId: null, name: "Mystery", quantity: 1 }]),
    ],
    costs,
  );
  assert.equal(p.covered.orders, 0);
  assert.equal(p.covered.profitFils, 0);
  assert.deepEqual(p.gaps, [
    { kind: "dish", name: "Fesenjan", reason: "not_approved", quantity: 3 },
    { kind: "dish", name: "Tahchin", reason: "no_recipe", quantity: 1 },
    { kind: "dish", name: "Mystery", reason: "not_matched", quantity: 1 },
  ]);
});

test("a receipt with no dishes read is not covered", () => {
  const p = estimateProfit([{ channel: "deliveroo", foodSalesFils: 4000, items: [], feesFils: 500 }], costs);
  assert.equal(p.covered.orders, 0);
  assert.deepEqual(p.gaps, [{ kind: "no_dishes", channel: "deliveroo", orders: 1 }]);
});

test("food cost is rounded once, after summing", () => {
  const p = estimateProfit([web(10500, [{ menuItemId: "kabab", name: "Kabab", quantity: 5 }])], costs);
  assert.equal(p.covered.foodCostFils, 9002);
  assert.equal(exVat(10500), 10000);
});

test("dish cost: verified approved version only", () => {
  const base = { totalFils: 1000, perUnitFils: 1000, lines: [], verified: true, issues: [] };
  assert.deepEqual(dishCostFrom(base), { ok: true, perPortionFils: 1000 });
  assert.deepEqual(dishCostFrom(null), { ok: false, reason: "not_approved" });
  assert.deepEqual(dishCostFrom({ ...base, verified: false, issues: [{ kind: "draft_prep", name: "Rice" }] }), { ok: false, reason: "prep_not_approved" });
  assert.deepEqual(dishCostFrom({ ...base, verified: false, issues: [{ kind: "no_price", name: "Saffron" }] }), { ok: false, reason: "no_price" });
  assert.deepEqual(dishCostFrom({ ...base, verified: false, issues: [{ kind: "no_lines" }] }), { ok: false, reason: "not_approved" });
});

test("low stock: below zero first, then at or below the warning level", () => {
  const row = (id: string, onHand: number, lowStockAt: number | null) => ({ id, name: id, nameFa: null, unit: "G" as const, onHand, lowStockAt });
  const { negative, low } = lowStock([row("rice", 5000, 10000), row("oil", -200, null), row("lamb", 9000, 3000), row("salt", 0, 0), row("herbs", 100, 1000)]);
  assert.deepEqual(negative.map((r) => r.id), ["oil"]);
  assert.deepEqual(low.map((r) => r.id), ["salt", "herbs", "rice"]);
});

test("credit invoices: overdue and due within three days", () => {
  const now = new Date("2026-10-15T08:00:00Z");
  const d = (s: string) => new Date(s);
  const due = creditDue(
    [
      { totalFils: 1000, dueDate: d("2026-10-10T00:00:00Z") },
      { totalFils: 2000, dueDate: d("2026-10-17T00:00:00Z") },
      { totalFils: 4000, dueDate: d("2026-10-30T00:00:00Z") },
      { totalFils: 8000, dueDate: null },
    ],
    now,
  );
  assert.deepEqual(due, { overdue: { count: 1, fils: 1000 }, soon: { count: 1, fils: 2000 } });
});

test("AI limit levels", () => {
  assert.equal(aiLevel(10, 30), "ok");
  assert.equal(aiLevel(24, 30), "near");
  assert.equal(aiLevel(30, 30), "reached");
  assert.equal(aiLevel(0, 0), "reached");
});
