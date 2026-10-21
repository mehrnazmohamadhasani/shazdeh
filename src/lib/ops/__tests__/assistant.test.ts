import { test } from "node:test";
import assert from "node:assert/strict";
import { bigCountDifference, checkDay, findByName, nameScore, normalizeText, toStockUnit } from "../assistant/match";
import { fixUnitPrice, type FixInvoice } from "../assistant/invoice-fix";
import { mayUse, openAiTools, toolArgs, toolsFor } from "../assistant/definitions";
import { secondsCostMicroUsd, voiceCostMicroUsd, voicePrices } from "../ai-price";
import { conversationTitle, moneyForModel, pricePerBigUnit, replyLanguage } from "../assistant/model-format";
import { freeFoodTotals, summariseFreeFood } from "../free-food-shared";

/*
 * The voice and chat assistant (M4): names said in Persian, English or
 * Arabic, spoken amounts, what needs a second confirmation, the invoice
 * price correction, and which tools each role gets.
 */

const items = [
  { id: "c1", name: "Beef topside", nameFa: "گوشت گوساله" },
  { id: "c2", name: "Beef mince", nameFa: "گوشت چرخ‌کرده" },
  { id: "c3", name: "Rice Sella 1121", nameFa: "برنج", aliases: ["fanoos classic sella 1121"] },
  { id: "c4", name: "Herbs mix", nameFa: "سبزی قورمه" },
  { id: "c5", name: "Ghormeh Sabzi", nameFa: "قرمه سبزی" },
];

test("Arabic letters, Persian digits and joiners are read as Persian", () => {
  assert.equal(normalizeText("كيلو"), normalizeText("کیلو"));
  assert.equal(normalizeText("۱۲۳"), "123");
  assert.equal(normalizeText("٣٨"), "38");
  assert.equal(normalizeText("قرمه‌سبزی"), "قرمه سبزی");
  assert.equal(normalizeText("Ghormeh  Sabzi!"), normalizeText("qormeh sabzi"));
});

test("a name is found by English, Persian, a learned alias or a near miss", () => {
  assert.deepEqual(findByName("برنج", items), { ok: true, item: items[2] });
  assert.deepEqual(findByName("Fanoos Classic Sella 1121", items), { ok: true, item: items[2] });
  assert.deepEqual(findByName("قرمه‌سبزی", items), { ok: true, item: items[4] });
  assert.deepEqual(findByName("gormeh sabsi", items), { ok: true, item: items[4] });
  assert.deepEqual(findByName("rice", items), { ok: true, item: items[2] });
  assert.deepEqual(findByName("mince", items), { ok: true, item: items[1] });
  // An id from an earlier answer is taken as is.
  assert.deepEqual(findByName("c4", items), { ok: true, item: items[3] });
});

test("two close names are not guessed between", () => {
  const r = findByName("beef", items);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.reason, "ambiguous");
  assert.deepEqual(!r.ok && r.reason === "ambiguous" && r.candidates.map((c) => c.id).sort(), ["c1", "c2"]);
  const none = findByName("saffron", items);
  assert.equal(!none.ok && none.reason, "not_found");
  assert.equal(nameScore("", "rice"), 0);
});

test("spoken amounts become the ingredient's own unit, or are refused", () => {
  assert.equal(toStockUnit(2, "kg", "G"), 2000);
  assert.equal(toStockUnit(0.5, "kg", "G"), 500);
  assert.equal(toStockUnit(150, "g", "G"), 150);
  assert.equal(toStockUnit(1.5, "l", "ML"), 1500);
  assert.equal(toStockUnit(12, "pcs", "PCS"), 12);
  // Kilos of eggs counted in pieces: ask, don't convert.
  assert.equal(toStockUnit(2, "kg", "PCS"), null);
  assert.equal(toStockUnit(2, "pcs", "G"), null);
});

test("a big count difference needs a second confirmation", () => {
  assert.equal(bigCountDifference(10_000, 9_000, 3_000), false); // 10 %, AED 30
  assert.equal(bigCountDifference(10_000, 7_000, 3_000), true); // 30 %
  assert.equal(bigCountDifference(100_000, 95_000, 15_000), true); // 5 % but AED 150
  assert.equal(bigCountDifference(0, 500, null), true); // the books said none
  assert.equal(bigCountDifference(500, 500, null), false);
});

test("days the model passes must be real, past and recent", () => {
  assert.deepEqual(checkDay(null, "2026-10-16"), { ok: true, day: "2026-10-16" });
  assert.deepEqual(checkDay("2026-10-15", "2026-10-16"), { ok: true, day: "2026-10-15" });
  assert.equal(checkDay("2026-10-17", "2026-10-16").ok, false);
  assert.equal(checkDay("yesterday", "2026-10-16").ok, false);
  assert.equal(checkDay("2026-06-01", "2026-10-16").ok, false);
});

test("correcting a unit price with VAT added at the bottom", () => {
  // Rice 10 kg × 35.00 = 350, VAT 17.50 at the bottom, total 367.50.
  const inv: FixInvoice = {
    pricesIncludeVat: false,
    subtotalFils: 35_000,
    vatFils: 1_750,
    totalFils: 36_750,
    lines: [{ id: "l1", quantity: 10, unitPriceFils: 3_500, discountFils: 0, vatFils: null, lineTotalFils: 35_000 }],
  };
  assert.deepEqual(fixUnitPrice(inv, "l1", 3_800), {
    ok: true,
    line: { unitPriceFils: 3_800, lineTotalFils: 38_000, vatFils: null },
    invoice: { subtotalFils: 38_000, vatFils: 1_900, totalFils: 39_900 },
  });
});

test("correcting a unit price on a line printed with its VAT (SAFCO style)", () => {
  // 2 × 100 = 200 + VAT 10 on the line = 210; two lines, total 315.
  const inv: FixInvoice = {
    pricesIncludeVat: false,
    subtotalFils: null,
    vatFils: 1_500,
    totalFils: 31_500,
    lines: [
      { id: "a", quantity: 2, unitPriceFils: 10_000, discountFils: 0, vatFils: 1_000, lineTotalFils: 21_000 },
      { id: "b", quantity: 1, unitPriceFils: 10_000, discountFils: 0, vatFils: 500, lineTotalFils: 10_500 },
    ],
  };
  const r = fixUnitPrice(inv, "a", 12_000);
  assert.ok(r.ok);
  assert.deepEqual(r.line, { unitPriceFils: 12_000, lineTotalFils: 25_200, vatFils: 1_200 });
  assert.deepEqual(r.invoice, { subtotalFils: null, vatFils: 1_700, totalFils: 35_700 });
});

test("correcting a shop receipt whose prices include VAT", () => {
  const inv: FixInvoice = {
    pricesIncludeVat: true,
    subtotalFils: null,
    vatFils: 500,
    totalFils: 10_500,
    lines: [{ id: "x", quantity: 1, unitPriceFils: 10_500, discountFils: 0, vatFils: null, lineTotalFils: 10_500 }],
  };
  const r = fixUnitPrice(inv, "x", 21_000);
  assert.ok(r.ok);
  assert.equal(r.invoice.totalFils, 21_000);
  assert.equal(r.invoice.vatFils, 1_000);
});

test("a price that can't be corrected is refused with the reason", () => {
  const inv: FixInvoice = {
    pricesIncludeVat: false,
    subtotalFils: null,
    vatFils: null,
    totalFils: 1_000,
    lines: [
      { id: "p", quantity: 1, unitPriceFils: null, discountFils: 0, vatFils: null, lineTotalFils: 1_000 },
      { id: "q", quantity: 1, unitPriceFils: 1_000, discountFils: 0, vatFils: null, lineTotalFils: 1_000 },
    ],
  };
  assert.deepEqual(fixUnitPrice(inv, "p", 900), { ok: false, error: "no_unit_price" });
  assert.deepEqual(fixUnitPrice(inv, "q", 1_000), { ok: false, error: "same_price" });
  assert.deepEqual(fixUnitPrice(inv, "zz", 900), { ok: false, error: "no_line" });
});

test("each role gets only its tools: the purchaser sees no money", () => {
  const purchaser = toolsFor("PURCHASER");
  for (const t of ["stock_level", "recent_purchases", "record_waste", "record_staff_meal", "stock_count", "fix_invoice_price"]) assert.ok(purchaser.includes(t as never), t);
  for (const t of ["recipe_info", "today_summary", "sales_summary", "payables", "change_recipe", "adjust_stock"]) assert.ok(!purchaser.includes(t as never), t);
  assert.deepEqual(toolsFor("STAFF"), []);
  assert.equal(toolsFor("ADMIN").length, Object.keys(toolArgs).length);
  assert.ok(!mayUse("PURCHASER", "sales_summary"));
  assert.ok(!mayUse("ADMIN", "drop_table"));
  assert.ok(openAiTools("PURCHASER").every((t) => t.strict && purchaser.includes(t.name)));
});

test("tool arguments are checked before anything runs", () => {
  assert.ok(toolArgs.record_waste.safeParse({ item: "herbs", quantity: 2, unit: "kg", day: null, note: null }).success);
  assert.ok(!toolArgs.record_waste.safeParse({ item: "herbs", quantity: -2, unit: "kg", day: null, note: null }).success);
  assert.ok(!toolArgs.record_waste.safeParse({ item: "herbs", quantity: 2, unit: "bunch", day: null, note: null }).success);
  assert.ok(!toolArgs.adjust_stock.safeParse({ item: "rice", quantity: 0, unit: "kg", reason: "x" }).success);
  assert.ok(toolArgs.change_recipe.safeParse({ recipe: "Ghormeh", changes: [{ item: "beef", quantity: null, unit: "g" }], note: null }).success);
});

test("a dictated recipe: owner and manager only, every line with an amount and unit", () => {
  assert.ok(toolsFor("ADMIN").includes("write_recipe") && toolsFor("EDITOR").includes("write_recipe"));
  assert.ok(!mayUse("PURCHASER", "write_recipe"));
  const ok = { dish: "قرمه سبزی", portions: 10, lines: [{ item: "lamb", quantity: 1.2, unit: "kg" }, { item: "سبزی", quantity: 800, unit: "g" }], note: null };
  assert.ok(toolArgs.write_recipe.safeParse(ok).success);
  assert.ok(toolArgs.write_recipe.safeParse({ ...ok, portions: null }).success);
  assert.ok(!toolArgs.write_recipe.safeParse({ ...ok, lines: [] }).success, "no lines");
  assert.ok(!toolArgs.write_recipe.safeParse({ ...ok, lines: [{ item: "lamb", quantity: 0, unit: "g" }] }).success, "zero amount");
  assert.ok(!toolArgs.write_recipe.safeParse({ ...ok, lines: [{ item: "lamb", quantity: 2, unit: "handful" }] }).success, "no weight");
  assert.ok(!toolArgs.write_recipe.safeParse({ ...ok, portions: 0 }).success, "zero portions");
  // The model's strict schema asks for the same fields the server checks.
  const schema = openAiTools("ADMIN").find((t) => t.name === "write_recipe")!.parameters as { required: string[] };
  assert.deepEqual([...schema.required].sort(), Object.keys(toolArgs.write_recipe.shape).sort());
});

test("speech-to-text is priced at its own rates", () => {
  const p = voicePrices({});
  assert.deepEqual(p, { inputPerMTok: 6, outputPerMTok: 10, textInputPerMTok: 2.5 });
  // A 5-second note: 40 audio tokens, a 200-token vocabulary prompt, 18 tokens out ≈ US$ 0.0009.
  assert.equal(voiceCostMicroUsd({ audioTokens: 40, textTokens: 200, outputTokens: 18 }, p), 920);
  assert.equal(secondsCostMicroUsd(60), 6_000); // US$ 0.006 a minute
});

test("the answer's language follows the latest message", () => {
  assert.equal(replyLanguage("How much beef is left?"), "English");
  assert.equal(replyLanguage("۲ کیلو سبزی دور ریختیم"), "Persian");
  assert.equal(replyLanguage("چقدر گوشت مانده؟"), "Persian");
  assert.equal(replyLanguage("كم بقي من اللحم؟"), "Arabic");
  assert.equal(replyLanguage("Change beef in قرمه سبزی to 150 g"), "English");
  assert.equal(replyLanguage("قیمت Fanoos رو درست کن"), "Persian");
  // Finglish is Persian; English that shares a word with it stays English.
  assert.equal(replyLanguage("chand kilo berenj darim?"), "Persian");
  assert.equal(replyLanguage("2 kilo piaz dur rikhtim"), "Persian");
  assert.equal(replyLanguage("salam"), "Persian");
  assert.equal(replyLanguage("Are we low on ham?"), "English");
  assert.equal(replyLanguage("How much rice is left?"), "English");
  assert.equal(replyLanguage("12"), "English");
});

test("the model is given AED, never fils to divide", () => {
  assert.deepEqual(moneyForModel({ valueFils: 3000, cost: { beforeFils: 1.1, afterFils: null }, rows: [{ unitPriceFils: 3850, name: "rice" }] }), {
    valueAed: 30,
    cost: { beforeAed: 0.011, afterAed: null },
    rows: [{ unitPriceAed: 38.5, name: "rice" }],
  });
  assert.deepEqual(pricePerBigUnit(1.5, "G"), { aed: 15, per: "kg" });
  assert.deepEqual(pricePerBigUnit(250, "PCS"), { aed: 2.5, per: "piece" });
});

test("a conversation is named after its first message, on one line", () => {
  assert.equal(conversationTitle("  How much\n beef   is left? "), "How much beef is left?");
  const long = conversationTitle("x".repeat(100));
  assert.equal(long.length, 60);
  assert.ok(long.endsWith("…"));
});

test("free food: the cost is unknown as soon as one dish has none, never counted as zero", () => {
  assert.deepEqual(
    freeFoodTotals([
      { quantity: 2, unitCostFils: 1_850, menuPriceFils: 12_800 },
      { quantity: 1, unitCostFils: 600, menuPriceFils: 3_600 },
    ]),
    { costFils: 4_300, menuValueFils: 29_200, portions: 3 },
  );
  assert.equal(freeFoodTotals([{ quantity: 2, unitCostFils: 1_850, menuPriceFils: 12_800 }, { quantity: 1, unitCostFils: null, menuPriceFils: 9_800 }]).costFils, null);
  const s = summariseFreeFood([
    { kind: "STAFF_MEAL", costFils: 3_000, menuValueFils: 20_000, portions: 4 },
    { kind: "GIFT", costFils: null, menuValueFils: 9_800, portions: 1 },
    { kind: "STAFF_MEAL", costFils: 1_000, menuValueFils: 5_000, portions: 1 },
  ]);
  assert.deepEqual(s.byKind.map((k) => [k.kind, k.portions, k.costFils]), [["STAFF_MEAL", 5, 4_000], ["GIFT", 1, null]]);
  assert.equal(s.knownCostFils, 4_000);
  assert.equal(s.unknownRecords, 1);
  assert.ok(toolsFor("PURCHASER").includes("record_free_food"));
  assert.ok(!toolsFor("STAFF").includes("record_free_food"));
});
