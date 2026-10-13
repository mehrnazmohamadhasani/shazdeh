import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount, lineStockAmount, normalizeName, parsePackSize } from "../units";
import { checkExtraction, isValidTrn } from "../checks";
import type { Extraction, ExtractedLine } from "../extraction";

/*
 * Cases come from real SHĀZDEH purchase documents (Ops brief §3.2).
 */

test("pack sizes from columns and product names", () => {
  assert.deepEqual(parsePackSize("4 x 10 kg"), { unit: "g", amount: 40000 });
  assert.deepEqual(parsePackSize("4×10KG"), { unit: "g", amount: 40000 });
  assert.deepEqual(parsePackSize("TOMATO PASTE 800G"), { unit: "g", amount: 800 });
  assert.deepEqual(parsePackSize("Rose water 1000ml"), { unit: "ml", amount: 1000 });
  assert.deepEqual(parsePackSize("Milk 2 L"), { unit: "ml", amount: 2000 });
  assert.deepEqual(parsePackSize("Yoghurt 3.8 kg"), { unit: "g", amount: 3800 });
  assert.deepEqual(parsePackSize("12 x 330ml"), { unit: "ml", amount: 3960 });
  assert.deepEqual(parsePackSize("TAKSA VERJUICE 500CC"), { unit: "ml", amount: 500 });
  assert.deepEqual(parsePackSize("DEL LEMON JUICE 3LTR 4 X PCS"), { unit: "ml", amount: 3000 });
  assert.equal(parsePackSize("Fanoos Classic Sella 1121"), null);
  assert.equal(parsePackSize("GN pan 1/3 150MM"), null);
  assert.equal(parsePackSize(null), null);
});

const line = (over: Partial<ExtractedLine>): ExtractedLine => ({
  description: "Item",
  itemCode: null,
  quantity: 1,
  unit: null,
  packSize: null,
  unitPrice: null,
  discount: null,
  vat: null,
  lineTotal: null,
  category: "food",
  stockUnit: null,
  stockQuantity: null,
  confidence: 0.95,
  note: null,
  ...over,
});

test("stock quantity of a line", () => {
  // Rasti Lari: 5 cartons of 4 x 10 kg rice
  assert.deepEqual(lineStockAmount(line({ quantity: 5, unit: "CTN", packSize: "4 x 10 kg", description: "Fanoos Sella" })), { unit: "g", amount: 200000 });
  // Rashid Mumtaz: lamb leg 15 kg
  assert.deepEqual(lineStockAmount(line({ quantity: 15, unit: "kg", description: "Lamb leg" })), { unit: "g", amount: 15000 });
  // Hexing: size only in the name
  assert.deepEqual(lineStockAmount(line({ quantity: 2, unit: "Pcs", description: "TOMATO PASTE 800G" })), { unit: "g", amount: 1600 });
  // Bakery: plain pieces
  assert.deepEqual(lineStockAmount(line({ quantity: 20, unit: "pcs", description: "Lavash bread" })), { unit: "pcs", amount: 20 });
  // Unknown pack: ask, don't guess
  assert.equal(lineStockAmount(line({ quantity: 3, unit: "TIN", description: "Kashk" })), null);
  assert.equal(lineStockAmount(line({ quantity: null, unit: "kg", description: "Onion" })), null);
});

test("formatting and names", () => {
  assert.equal(formatAmount(40000, "g"), "40 kg");
  assert.equal(formatAmount(750, "ml"), "750 ml");
  assert.equal(formatAmount(1500, "ml"), "1.5 L");
  assert.equal(normalizeName("  Fanoos  Sella 1121 "), "fanoos sella 1121");
});

test("TRN format", () => {
  assert.equal(isValidTrn("100123456700003"), true);
  assert.equal(isValidTrn("100-1234-5670-0003"), true);
  assert.equal(isValidTrn("104100379700003"), true); // Rashid Mumtaz prints 104…
  assert.equal(isValidTrn("1002467591600003"), false); // 16 digits: a misread
  assert.equal(isValidTrn("12345"), false);
});

const doc = (over: Partial<Extraction>): Extraction => ({
  documentType: "supplier_invoice",
  handwritten: false,
  supplier: { name: "Bait Al Khodamouni Bakery", trn: null, phone: null },
  invoiceNumber: "1",
  invoiceDate: new Date().toISOString().slice(0, 10),
  paymentMode: "cash",
  currency: "AED",
  pricesIncludeVat: false,
  lines: [],
  subtotal: null,
  discount: null,
  vat: null,
  total: null,
  notes: null,
  confidence: 0.9,
  ...over,
});

test("a correct invoice has no errors", () => {
  // Bakery: lavash 20 × 5.00 = 100, VAT 5 → 105
  const flags = checkExtraction(
    doc({ lines: [line({ quantity: 20, unitPrice: 5, lineTotal: 100 })], subtotal: 100, vat: 5, total: 105 }),
  );
  assert.equal(flags.filter((f) => f.level === "error").length, 0);
});

test("line totals that include VAT (SAFCO) are not flagged", () => {
  // 3 cartons: 100 + 5% = 105, 95 → 99.75, 85 → 89.25; subtotal 280, VAT 14, total 294
  const flags = checkExtraction(
    doc({
      lines: [
        line({ quantity: 1, unitPrice: 100, vat: 5, lineTotal: 105, category: "packaging" }),
        line({ quantity: 1, unitPrice: 95, vat: 4.75, lineTotal: 99.75, category: "packaging" }),
        line({ quantity: 1, unitPrice: 85, vat: 4.25, lineTotal: 89.25, category: "packaging" }),
      ],
      subtotal: 280,
      vat: 14,
      total: 294,
    }),
  );
  assert.equal(flags.filter((f) => f.level === "error").length, 0);
});

test("line arithmetic mismatch is flagged", () => {
  const flags = checkExtraction(doc({ lines: [line({ quantity: 20, unitPrice: 5, lineTotal: 110 })], subtotal: 110, total: 110 }));
  assert.ok(flags.some((f) => f.field === "line:0" && f.level === "error"));
});

test("lines that don't add up to the total are flagged (Union Coop)", () => {
  const flags = checkExtraction(
    doc({ documentType: "shop_receipt", lines: [line({ quantity: 1, unitPrice: 20, lineTotal: 20 }), line({ quantity: 1, unitPrice: 22.31, lineTotal: 22.31 })], total: 1436.88 }),
  );
  assert.ok(flags.some((f) => f.field === "total" && f.level === "error"));
});

test("invoice-level discount (A to Z) and non-food lines", () => {
  const flags = checkExtraction(
    doc({ lines: [line({ quantity: 1, unitPrice: 600.3, lineTotal: 600.3, category: "smallwares" })], subtotal: 600.3, discount: 90.78, vat: 25.48, total: 535 }),
  );
  assert.equal(flags.filter((f) => f.level === "error").length, 0);
  assert.ok(flags.some((f) => f.field === "line:0" && f.level === "info"));
});

test("missing total and card-slip-only receipts", () => {
  const flags = checkExtraction(doc({ documentType: "card_slip", lines: [], total: null }));
  assert.ok(flags.some((f) => f.field === "total" && f.level === "error"));
  assert.ok(flags.some((f) => f.field === "lines"));
});

test("a negative printed discount is still a discount (Talabat)", () => {
  const flags = checkExtraction(doc({ lines: [line({ quantity: 1, unitPrice: 98, lineTotal: 98 })], subtotal: 98, discount: -16, total: 82 }));
  assert.equal(flags.filter((f) => f.field === "total").length, 0);
});

test("platform order receipts are flagged as sales", () => {
  const flags = checkExtraction(doc({ documentType: "platform_order", supplier: { name: "Talabat", trn: null, phone: null } }));
  assert.ok(flags.some((f) => f.field === "document" && f.level === "error"));
});

test("a line VAT read as the rate (5) instead of the amount still checks out (SAFCO)", () => {
  const flags = checkExtraction(doc({ lines: [line({ quantity: 1, unitPrice: 85, vat: 5, lineTotal: 89.25 })], subtotal: 85, vat: 4.25, total: 89.25 }));
  assert.equal(flags.filter((f) => f.field === "line:0").length, 0);
});

test("a date in the future is flagged (Noon misread)", () => {
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const flags = checkExtraction(doc({ invoiceDate: future, total: 1 }));
  assert.ok(flags.some((f) => f.field === "invoiceDate" && f.level === "warn"));
});

// ─── Costing: food cost without VAT ──────────────────────────────────────────
import { costLines } from "../costing";

const cl = (over: Partial<Parameters<typeof costLines>[0][number]>) => ({ quantity: 1, unitPrice: null, discount: 0, vat: null, lineTotal: 0, ...over });

test("SAFCO: line totals include VAT → cost is the ex-VAT amount", () => {
  const out = costLines(
    [cl({ unitPrice: 100, vat: 5, lineTotal: 105 }), cl({ unitPrice: 95, vat: 5, lineTotal: 99.75 }), cl({ unitPrice: 85, vat: 4.25, lineTotal: 89.25 })],
    { pricesIncludeVat: false, discount: 0 },
  );
  assert.deepEqual(out.map((o) => o.netFils), [10000, 9500, 8500]);
  assert.deepEqual(out.map((o) => o.vatFils), [500, 475, 425]);
});

test("Bakery: lines without VAT, VAT added once at the bottom", () => {
  const out = costLines([cl({ quantity: 20, unitPrice: 5, lineTotal: 100 })], { pricesIncludeVat: false, discount: 0 });
  assert.equal(out[0].netFils, 10000);
});

test("A to Z: invoice discount is spread over the lines and adds up exactly", () => {
  const out = costLines([cl({ lineTotal: 400.3 }), cl({ lineTotal: 200 })], { pricesIncludeVat: false, discount: 90.78 });
  assert.equal(out[0].netFils + out[1].netFils, 50952);
  assert.ok(out[0].netFils > out[1].netFils);
});

test("Shop receipt with VAT-inclusive prices", () => {
  const out = costLines([cl({ quantity: 2, unitPrice: 10.5, lineTotal: 21 })], { pricesIncludeVat: true, discount: 0 });
  assert.equal(out[0].netFils, 2000);
  assert.equal(out[0].vatFils, 100);
});

// ─── Opening stock: pasted lists ─────────────────────────────────────────────
import { parseStockLines } from "../paste";

test("opening stock lines from Excel (tabs) and typed text", () => {
  assert.deepEqual(parseStockLines("Sella rice\t200\tkg\t5.25\nRose water\t12\tL\t8.5\nSoup cup\t500\tpcs"), [
    { name: "Sella rice", unit: "g", quantity: 200, price: 5.25 },
    { name: "Rose water", unit: "ml", quantity: 12, price: 8.5 },
    { name: "Soup cup", unit: "pcs", quantity: 500, price: null },
  ]);
  // typed with commas; grams become kg and the price follows
  assert.deepEqual(parseStockLines("Saffron, 250, g, 0.9"), [{ name: "Saffron", unit: "g", quantity: 0.25, price: 900 }]);
  // no separators
  assert.deepEqual(parseStockLines("Lamb leg 15 kg 40"), [{ name: "Lamb leg", unit: "g", quantity: 15, price: 40 }]);
  // Persian, with Persian digits and the Persian comma
  assert.deepEqual(parseStockLines("برنج سلا، ۲۰۰، کیلو، ۵.۲۵"), [{ name: "برنج سلا", unit: "g", quantity: 200, price: 5.25 }]);
  // thousands separator
  assert.deepEqual(parseStockLines("Bags\t1,200\tpcs\t0.5"), [{ name: "Bags", unit: "pcs", quantity: 1200, price: 0.5 }]);
});

test("supplies are stock but not food cost; equipment is neither", async () => {
  const { isStockCategory } = await import("../extraction");
  assert.equal(isStockCategory("supplies"), true);
  assert.equal(isStockCategory("food"), true);
  assert.equal(isStockCategory("packaging"), true);
  assert.equal(isStockCategory("smallwares"), false);
  assert.equal(isStockCategory("delivery"), false);
});
