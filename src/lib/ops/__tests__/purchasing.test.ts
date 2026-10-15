import { test } from "node:test";
import assert from "node:assert/strict";
import { costLines, grossLines } from "../costing";
import { cashBalances } from "../cash-balance";
import { aiCostMicroUsd, aiPrices, dubaiMonth, dubaiMonthStart } from "../ai-price";
import { vatRow, type VatInvoice } from "../vat-rows";
import { roleHome, roleMayOpen } from "../../roles";

/*
 * Purchasing follow-ups from the owner's answers (2026-10-15): food cost
 * with or without VAT, owner cash, the VAT export, the AI limit and the
 * purchaser role.
 */

test("gross cost spreads the paid VAT over the lines and adds up to the total", () => {
  // Bakery: 20 × 5.00 = 100, VAT 5 at the bottom, total 105.
  assert.deepEqual(grossLines([10000], { totalFils: 10500, hasVat: true }), [10500]);
  // Rice + paste + kashk, VAT 54.01 on 1,080.15 → total 1,134.16.
  const net = costLines(
    [
      { quantity: 5, unitPrice: 209.53, discount: 0, vat: null, lineTotal: 1047.65 },
      { quantity: 2, unitPrice: 9.5, discount: 0, vat: null, lineTotal: 19 },
      { quantity: 3, unitPrice: 4.5, discount: 0, vat: null, lineTotal: 13.5 },
    ],
    { pricesIncludeVat: false, discount: 0 },
  ).map((c) => c.netFils);
  const gross = grossLines(net, { totalFils: 113416, hasVat: true });
  assert.equal(gross.reduce((s, n) => s + n, 0), 113416);
  assert.ok(gross.every((g, i) => g >= net[i]));
});

test("gross cost never invents VAT", () => {
  // Handwritten veg bill: no VAT, total = lines.
  assert.deepEqual(grossLines([30000, 24050], { totalFils: 54050, hasVat: false }), [30000, 24050]);
  // Totals that don't add up: 5 % only if the invoice shows VAT, otherwise none.
  assert.deepEqual(grossLines([10000], { totalFils: 20000, hasVat: true }), [10500]);
  assert.deepEqual(grossLines([10000], { totalFils: 20000, hasVat: false }), [10000]);
  assert.deepEqual(grossLines([], { totalFils: 0, hasVat: true }), []);
});

test("owner cash: withdrawals against presented invoices, per person", () => {
  const rows = cashBalances(
    [
      { person: "Owner", amountFils: 200000 },
      { person: " owner ", amountFils: 50000 },
      { person: "Reza", amountFils: 10000 },
    ],
    [
      { person: "OWNER", amountFils: 143688 },
      { person: "Reza", amountFils: 12500 },
      { person: "Company card", amountFils: 9000 },
    ],
  );
  const owner = rows.find((r) => r.person === "Owner")!;
  assert.deepEqual(owner, { person: "Owner", withdrawnFils: 250000, presentedFils: 143688, balanceFils: 106312 });
  assert.equal(rows.find((r) => r.person === "Reza")!.balanceFils, -2500); // the business owes Reza
  assert.equal(rows[0].person, "Owner"); // largest gap first
});

test("AI cost and the Dubai month", () => {
  const prices = aiPrices({});
  assert.deepEqual(prices, { inputPerMTok: 0.25, outputPerMTok: 2 });
  // 4,000 in + 1,500 out ≈ $0.004 = 4,000 micro-dollars.
  assert.equal(aiCostMicroUsd(4000, 1500, prices), 4000);
  assert.deepEqual(aiPrices({ AI_PRICE_INPUT_PER_MTOK: "1.5", AI_PRICE_OUTPUT_PER_MTOK: "oops" }), { inputPerMTok: 1.5, outputPerMTok: 2 });
  // 31 Oct 21:30 UTC is already 1 Nov in Dubai.
  assert.equal(dubaiMonth(new Date("2026-10-31T21:30:00Z")), "2026-11");
  assert.equal(dubaiMonthStart(new Date("2026-10-15T10:00:00Z")).toISOString(), "2026-09-30T20:00:00.000Z");
});

const inv = (over: Partial<VatInvoice>): VatInvoice => ({
  invoiceDate: new Date("2026-10-09T08:00:00Z"),
  supplierName: "Rasti Lari General Trading",
  supplierTrn: "100234567800003",
  invoiceNo: "RL-20931",
  paymentMode: "credit",
  pricesIncludeVat: false,
  vatFils: 5401,
  totalFils: 113416,
  linesNetFils: [104765, 1900, 1350],
  ...over,
});

test("VAT rows: printed VAT, calculated VAT and what to check", () => {
  const printed = vatRow(inv({}));
  assert.equal(printed.vatSource, "printed");
  assert.equal(printed.netFils, 108015);
  assert.deepEqual(printed.check, []);

  // Shop receipt: VAT-inclusive total only.
  const shop = vatRow(inv({ vatFils: null, pricesIncludeVat: true, totalFils: 10500, linesNetFils: [10000], supplierTrn: null, invoiceNo: null }));
  assert.equal(shop.vatFils, 500);
  assert.equal(shop.vatSource, "calculated");
  assert.deepEqual(shop.check, ["No supplier TRN", "VAT not printed; calculated from the total", "No invoice number"]);

  // Handwritten veg: no VAT at all, nothing to claim.
  const veg = vatRow(inv({ vatFils: null, totalFils: 54050, linesNetFils: [54050], supplierTrn: null }));
  assert.equal(veg.vatFils, 0);
  assert.equal(veg.vatSource, "none");
  assert.deepEqual(veg.check, []);

  assert.deepEqual(vatRow(inv({ supplierTrn: "12345" })).check, ["TRN not 15 digits"]);
});

test("roles: the purchaser sees purchasing screens only", () => {
  assert.equal(roleHome("PURCHASER"), "/admin/ops/invoices");
  assert.ok(roleMayOpen("PURCHASER", "/admin/ops/invoices/abc"));
  assert.ok(roleMayOpen("PURCHASER", "/admin/ops/stock/count"));
  assert.ok(roleMayOpen("PURCHASER", "/admin/ops/suppliers"));
  assert.ok(roleMayOpen("PURCHASER", "/admin/ops/sales/receipts/abc")); // record platform receipts…
  assert.ok(!roleMayOpen("PURCHASER", "/admin/ops/sales")); // …but not the sales totals
  assert.ok(!roleMayOpen("PURCHASER", "/admin/ops/channels"));
  assert.ok(!roleMayOpen("PURCHASER", "/admin/ops/payables"));
  assert.ok(!roleMayOpen("PURCHASER", "/admin/ops/cash"));
  assert.ok(!roleMayOpen("PURCHASER", "/admin/ops/stockholder"));
  assert.ok(!roleMayOpen("PURCHASER", "/admin"));
  assert.equal(roleHome("STAFF"), "/admin/orders");
  assert.ok(!roleMayOpen("STAFF", "/admin/ops/invoices"));
  assert.ok(roleMayOpen("ADMIN", "/admin/team"));
  assert.equal(roleHome("EDITOR"), "/admin");
});
