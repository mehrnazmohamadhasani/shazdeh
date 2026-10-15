import { test } from "node:test";
import assert from "node:assert/strict";
import { decideInvoiceAutoSave, decidePlatformAutoSave } from "../autosave";
import { draftFromReading, type MenuEntry } from "../platform";
import { samplePlatformReading, type PlatformReading } from "../platform-reading";
import type { Extraction } from "../extraction";
import type { Suggestions } from "../match";

/* Saved without a person only when nothing is uncertain. */

const NOW = new Date("2026-10-15T10:00:00Z");
const MENU: MenuEntry[] = [
  { id: "makaroni", name: "Makaroni", category: "Main Dishes", priceFils: 9800, isVegetarian: false },
  { id: "zereshk", name: "Zereshk Polo Morgh", category: "Main Dishes", priceFils: 9800, isVegetarian: false },
  { id: "tahchin-zereshk", name: "Zereshk Polo Tahchin", category: "Main Dishes", priceFils: 8800, isVegetarian: false },
];
const decidePlatform = (r: PlatformReading) => decidePlatformAutoSave(r, draftFromReading(r, MENU, () => []), MENU, 0.9, NOW);

test("a clear talabat receipt is saved as read", () => {
  const d = decidePlatform(samplePlatformReading());
  assert.ok(d.ok, JSON.stringify(d));
  if (!d.ok) return;
  assert.equal(d.input.placedAt, "2026-10-09T20:42"); // Dubai time, as on the receipt
  assert.equal(d.input.discountFundedBy, "UNKNOWN"); // never guessed
  assert.deepEqual(d.input.items, [{ rawName: "Makaroni", category: null, quantity: 1, lineTotal: 98, menuItemId: "makaroni" }]);
  assert.equal(d.input.total, 90.2);
});

test("sums that tie out allow a slightly lower overall self-rating", () => {
  // Real talabat #2322: everything correct, model rated itself 0.88.
  assert.equal(decidePlatform({ ...samplePlatformReading(), confidence: 0.88 }).ok, true);
});

test("anything uncertain waits for a person", () => {
  const base = samplePlatformReading();
  assert.equal(decidePlatform({ ...base, confidence: 0.75 }).ok, false); // unsure reading
  assert.equal(decidePlatform({ ...base, items: [{ ...base.items[0], confidence: 0.85 }] }).ok, false); // unsure dish
  assert.equal(decidePlatform({ ...base, total: 98.2 }).ok, false); // sums don't add up
  assert.equal(decidePlatform({ ...base, orderNo: null }).ok, false);
  // Deliveroo, two dishes, no prices: "Zereshk Polo" could be two menu items.
  const ambiguous = decidePlatform({
    ...base,
    platform: "deliveroo",
    items: [
      { name: "Zereshk Polo", category: "MAIN DISHES", quantity: 1, lineTotal: null, note: null, confidence: 0.95 },
      { name: "Makaroni", category: "MAIN DISHES", quantity: 1, lineTotal: null, note: null, confidence: 0.95 },
    ],
    subtotal: null,
    deliveryFee: null,
    serviceFee: null,
    discount: null,
    total: 196,
    itemCount: 2,
  });
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) assert.ok(ambiguous.reasons.some((r) => r.includes("Zereshk Polo")));
});

const invoice = (over: Partial<Extraction> = {}): Extraction => ({
  documentType: "supplier_invoice",
  handwritten: false,
  supplier: { name: "Rasti Lari General Trading", trn: "100234567800003", phone: null },
  invoiceNumber: "RL-20931",
  invoiceDate: "2026-10-09",
  paymentMode: "credit",
  currency: "AED",
  pricesIncludeVat: false,
  lines: [
    { description: "Fanoos Classic Sella 1121", itemCode: null, quantity: 5, unit: "CTN", packSize: "4 x 10 kg", unitPrice: 209.53, discount: null, vat: null, lineTotal: 1047.65, category: "food", stockUnit: "g", stockQuantity: 200000, confidence: 0.95, note: null },
    { description: "Delivery", itemCode: null, quantity: 1, unit: null, packSize: null, unitPrice: 50, discount: null, vat: null, lineTotal: 50, category: "delivery", stockUnit: null, stockQuantity: null, confidence: 0.95, note: null },
  ],
  subtotal: 1097.65,
  discount: null,
  vat: 54.88,
  total: 1152.53,
  notes: null,
  confidence: 0.95,
  ...over,
});
const learned: Suggestions = {
  supplierId: "rasti",
  supplierName: "Rasti Lari General Trading",
  lines: [
    { ingredientId: "rice", ingredientName: "Sella rice", unit: "g", quantity: 200000, source: "learned" },
    { ingredientId: null, ingredientName: null, unit: null, quantity: null, source: null },
  ],
};

test("an invoice from a known supplier with remembered items is saved", () => {
  const d = decideInvoiceAutoSave(invoice(), learned, 0.9, NOW);
  assert.ok(d.ok, JSON.stringify(d));
  if (!d.ok) return;
  assert.equal(d.input.supplier.id, "rasti");
  assert.deepEqual(d.input.lines[0].ingredient, { id: "rice", name: "Sella rice", unit: "g" });
  assert.equal(d.input.lines[0].stockQuantity, 200000);
  assert.equal(d.input.lines[1].ingredient, null); // delivery: not stock
});

test("new suppliers, new items, handwriting and bad sums wait for a person", () => {
  assert.equal(decideInvoiceAutoSave(invoice(), { ...learned, supplierId: null, supplierName: null }, 0.9, NOW).ok, false);
  assert.equal(decideInvoiceAutoSave(invoice(), { ...learned, lines: [{ ...learned.lines[0], source: "parsed" }, learned.lines[1]] }, 0.9, NOW).ok, false);
  assert.equal(decideInvoiceAutoSave(invoice({ handwritten: true }), learned, 0.9, NOW).ok, false);
  assert.equal(decideInvoiceAutoSave(invoice({ total: 1200 }), learned, 0.9, NOW).ok, false);
  assert.equal(decideInvoiceAutoSave(invoice({ documentType: "card_slip" }), learned, 0.9, NOW).ok, false);
});
