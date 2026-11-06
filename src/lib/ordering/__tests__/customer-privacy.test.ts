import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ERASED_ORDER_FIELDS,
  eraseBlocker,
  erasedClaimIdentity,
  maskedPhone,
} from "../customer-privacy-rules";
import { mergeCustomers } from "../customer-list";

const now = new Date("2026-11-06T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

test("erasing waits for orders still being cooked or delivered", () => {
  assert.equal(eraseBlocker([{ status: "DELIVERED", placedAt: hoursAgo(1) }, { status: "CANCELLED", placedAt: hoursAgo(2) }], now), null);
  assert.match(eraseBlocker([{ status: "OUT_FOR_DELIVERY", placedAt: hoursAgo(1) }], now)!, /in progress/);
  assert.match(eraseBlocker([{ status: "RECEIVED", placedAt: hoursAgo(100) }], now)!, /in progress/);
});

test("a recent unpaid online order blocks erasing; an abandoned one doesn't", () => {
  assert.match(eraseBlocker([{ status: "PENDING_PAYMENT", placedAt: hoursAgo(2) }], now)!, /payment/);
  assert.equal(eraseBlocker([{ status: "PENDING_PAYMENT", placedAt: hoursAgo(30) }], now), null);
  assert.equal(eraseBlocker([], now), null);
});

test("erased orders keep no name, mobile, email, address, location or notes", () => {
  for (const key of ["customerEmail", "street", "unit", "floor", "instructions", "lat", "lng", "notes", "customerId"] as const) {
    assert.equal(ERASED_ORDER_FIELDS[key], null, key);
  }
  assert.equal(ERASED_ORDER_FIELDS.customerName, "Deleted customer");
  assert.equal(ERASED_ORDER_FIELDS.customerPhone, "deleted");
  assert.equal(ERASED_ORDER_FIELDS.building, "—");
  // Money and tax fields are never touched.
  for (const key of ["totalFils", "vatFils", "subtotalFils", "placedAt"]) assert.ok(!(key in ERASED_ORDER_FIELDS), key);
});

test("erased gift claims get a unique placeholder and no consent", () => {
  const a = erasedClaimIdentity("c1");
  const b = erasedClaimIdentity("c2");
  assert.notEqual(a.phone, b.phone);
  assert.notEqual(a.email, b.email);
  assert.match(a.email, /@deleted\.invalid$/);
  assert.equal(a.name, null);
  assert.equal(a.marketingOptIn, false);
});

test("the audit log keeps only the last four digits", () => {
  assert.equal(maskedPhone("+971501234567"), "…4567");
});

test("erased orders don't appear as a customer in the list", () => {
  const rows = mergeCustomers([], [{ phone: "deleted", orders: 3, spentFils: 9000, lastOrderAt: now, lastOrderId: "o1" }], []);
  assert.deepEqual(rows, []);
});
