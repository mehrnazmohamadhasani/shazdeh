import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals, priceLines, repriceAfterRemoval, validateSelection, type PricingItem } from "../pricing";
import { kitchenStatus, parseWindow } from "../hours";
import { canTransition, nextStatus } from "../status";
import { normalizeUaeMobile, maskPhone } from "../phone";

const khoresh: PricingItem = {
  id: "k",
  name: "Karafs",
  portion: null,
  priceFils: 13800,
  orderable: true,
  groups: [
    { id: "rice", name: "Rice", minSelect: 1, maxSelect: 1, options: [
      { id: "plain", name: "Saffron basmati", priceFils: 0, isAvailable: true },
      { id: "tahdig", name: "With tahdig", priceFils: 1000, isAvailable: true },
    ] },
    { id: "extras", name: "Extras", minSelect: 0, maxSelect: 2, options: [
      { id: "rice2", name: "Extra rice", priceFils: 1400, isAvailable: true },
      { id: "herbs", name: "Herbs", priceFils: 900, isAvailable: false },
      { id: "kh2", name: "Extra khoresh", priceFils: 2200, isAvailable: true },
    ] },
  ],
};
const lookup = (id: string) => (id === "k" ? khoresh : undefined);

test("prices a line with options server-side", () => {
  const { priced, issues } = priceLines([{ itemId: "k", quantity: 2, optionIds: ["tahdig", "rice2"] }], lookup);
  assert.equal(issues.length, 0);
  assert.equal(priced[0].unitPriceFils, 13800 + 1000 + 1400);
  assert.equal(priced[0].lineTotalFils, 2 * 16200);
});

test("rejects missing required, too many, unavailable and foreign options", () => {
  assert.match(validateSelection(khoresh, [])!, /choose rice/i);
  assert.match(validateSelection(khoresh, ["plain", "tahdig"])!, /up to 1/);
  assert.match(validateSelection(khoresh, ["plain", "herbs"])!, /not available/);
  assert.match(validateSelection(khoresh, ["plain", "nope"])!, /no longer exists/);
  assert.match(validateSelection(khoresh, ["plain", "plain"])!, /twice/);
});

test("unknown and sold-out dishes become issues, never prices", () => {
  const sold = { ...khoresh, orderable: false };
  const r1 = priceLines([{ itemId: "x", quantity: 1, optionIds: [] }], lookup);
  const r2 = priceLines([{ itemId: "k", quantity: 1, optionIds: ["plain"] }], () => sold);
  assert.equal(r1.issues[0].code, "not_found");
  assert.equal(r2.issues[0].code, "unavailable");
});

const zone = { id: "z", name: "Central", feeFils: 700, minOrderFils: 6000, freeOverFils: 20000, etaMin: 30, etaMax: 45 };

test("VAT-inclusive totals back-calculate VAT and honour free delivery", () => {
  const t = computeTotals({ subtotalFils: 10000, zone, coupon: null, serviceFeeFils: 0, vatRate: 5, pricesIncludeVat: true });
  assert.equal(t.deliveryFeeFils, 700);
  assert.equal(t.totalFils, 10700);
  assert.equal(t.vatFils, Math.round((10700 * 5) / 105));
  const free = computeTotals({ subtotalFils: 20000, zone, coupon: null, serviceFeeFils: 0, vatRate: 5, pricesIncludeVat: true });
  assert.equal(free.deliveryFeeFils, 0);
});

test("VAT-exclusive totals add VAT on top", () => {
  const t = computeTotals({ subtotalFils: 10000, zone, coupon: null, serviceFeeFils: 0, vatRate: 5, pricesIncludeVat: false });
  assert.equal(t.vatFils, 535);
  assert.equal(t.totalFils, 11235);
});

test("minimum order shortfall is reported", () => {
  const t = computeTotals({ subtotalFils: 4000, zone, coupon: null, serviceFeeFils: 0, vatRate: 5, pricesIncludeVat: true });
  assert.equal(t.shortOfMinimumFils, 2000);
});

test("coupons: percent cap, minimum, fixed never exceeds basket, free delivery", () => {
  const pct = { code: "P", type: "PERCENT" as const, value: 10, minSubtotalFils: 8000, maxDiscountFils: 3000 };
  assert.equal(computeTotals({ subtotalFils: 50000, zone, coupon: pct, serviceFeeFils: 0, vatRate: 5, pricesIncludeVat: true }).discountFils, 3000);
  const below = computeTotals({ subtotalFils: 7000, zone, coupon: pct, serviceFeeFils: 0, vatRate: 5, pricesIncludeVat: true });
  assert.equal(below.discountFils, 0);
  assert.equal(below.couponApplied, false);
  const fixed = { code: "F", type: "FIXED" as const, value: 500, minSubtotalFils: 0, maxDiscountFils: null };
  const t = computeTotals({ subtotalFils: 6000, zone, coupon: fixed, serviceFeeFils: 0, vatRate: 5, pricesIncludeVat: true });
  assert.equal(t.discountFils, 6700);
  assert.equal(t.totalFils, 0);
  const fd = { code: "D", type: "FREE_DELIVERY" as const, value: 0, minSubtotalFils: 0, maxDiscountFils: null };
  assert.equal(computeTotals({ subtotalFils: 6000, zone, coupon: fd, serviceFeeFils: 0, vatRate: 5, pricesIncludeVat: true }).discountFils, 700);
});

test("hours: overnight windows and next opening (Dubai time)", () => {
  assert.deepEqual(parseWindow("18:00 — 02:00"), { open: 1080, close: 1560 });
  const hours = JSON.stringify({ mon: "12:00 — 23:00", tue: "18:00 — 02:00", wed: "Closed" });
  // Tue 2026-10-06 21:30 UTC = Wed 01:30 Dubai → still Tuesday's late window
  assert.equal(kitchenStatus(hours, "Asia/Dubai", new Date("2026-10-06T21:30:00Z")).isOpen, true);
  // Mon 2026-10-05 05:00 UTC = Mon 09:00 Dubai → opens today at 12:00
  const s = kitchenStatus(hours, "Asia/Dubai", new Date("2026-10-05T05:00:00Z"));
  assert.equal(s.isOpen, false);
  assert.equal(s.label, "Opens today at 12:00");
  // Wed 2026-10-07 08:00 UTC = Wed 12:00 Dubai, closed Wed → next is Monday
  assert.match(kitchenStatus(hours, "Asia/Dubai", new Date("2026-10-07T08:00:00Z")).label, /Monday/);
});

test("status machine: accept first, no skipping to delivered, reject only when new", () => {
  assert.equal(canTransition("RECEIVED", "CONFIRMED"), true);
  assert.equal(canTransition("RECEIVED", "PREPARING"), false);
  assert.equal(canTransition("RECEIVED", "DELIVERED"), false);
  assert.equal(canTransition("CONFIRMED", "READY"), true);
  assert.equal(canTransition("PREPARING", "REJECTED"), false);
  assert.equal(canTransition("OUT_FOR_DELIVERY", "CANCELLED"), true);
  assert.equal(canTransition("DELIVERED", "CANCELLED"), false);
  assert.equal(canTransition("PENDING_PAYMENT", "CONFIRMED"), false);
  assert.equal(nextStatus("READY"), "OUT_FOR_DELIVERY");
  assert.equal(nextStatus("DELIVERED"), null);
});

test("UAE mobile normalisation", () => {
  for (const v of ["050 123 4567", "+971 50 123 4567", "00971501234567", "501234567"]) {
    assert.equal(normalizeUaeMobile(v), "+971501234567");
  }
  assert.equal(normalizeUaeMobile("04 123 4567"), null); // landline
  assert.equal(normalizeUaeMobile("051 123 4567"), null); // not a mobile prefix
  assert.equal(maskPhone("+971501234567"), "+971 50 ••• 4567");
});

test("removing a sold-out dish keeps fees, shrinks percent promos, never raises the total", () => {
  const base = { deliveryFeeFils: 700, serviceFeeFils: 0, vatRate: 5, pricesIncludeVat: true };
  // 20000 → 12000 subtotal, no promo
  const plain = repriceAfterRemoval({ ...base, subtotalFils: 12000, discountFils: 0, coupon: null });
  assert.equal(plain.totalFils, 12700);
  assert.equal(plain.vatFils, Math.round((12700 * 5) / 105));
  // 10% promo was 2000 on 20000 → 1200 on 12000
  const pct = repriceAfterRemoval({ ...base, subtotalFils: 12000, discountFils: 2000, coupon: { type: "PERCENT", value: 10, maxDiscountFils: null } });
  assert.equal(pct.discountFils, 1200);
  assert.equal(pct.totalFils, 12000 + 700 - 1200);
  // Capped percent promo stays capped
  const capped = repriceAfterRemoval({ ...base, subtotalFils: 40000, discountFils: 3000, coupon: { type: "PERCENT", value: 10, maxDiscountFils: 3000 } });
  assert.equal(capped.discountFils, 3000);
  // Fixed promo is kept, but never more than what's left
  const fixed = repriceAfterRemoval({ ...base, subtotalFils: 1000, discountFils: 5000, coupon: { type: "FIXED", value: 50, maxDiscountFils: null } });
  assert.equal(fixed.discountFils, 1700);
  assert.equal(fixed.totalFils, 0);
});
