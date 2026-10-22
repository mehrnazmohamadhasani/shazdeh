import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesFilter, mergeCustomers } from "../customer-list";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

test("customers: one row per mobile from orders and gift claims", () => {
  const rows = mergeCustomers(
    [{ phone: "+971500000001", name: "Sara", email: null, marketingOptIn: false, createdAt: d("2026-09-01") }],
    [{ phone: "+971500000001", orders: 3, spentFils: 45000, lastOrderAt: d("2026-10-20"), lastOrderId: "o3" }],
    [
      { phone: "+971500000001", name: "Sara K", email: "sara@example.com", marketingOptIn: true, code: "GIFT15", used: true, createdAt: d("2026-10-01") },
      { phone: "+971500000002", name: null, email: "ali@example.com", marketingOptIn: false, code: "GIFT15", used: false, createdAt: d("2026-10-10") },
      { phone: "+971500000002", name: "Ali", email: "ali2@example.com", marketingOptIn: false, code: "VIP25", used: false, createdAt: d("2026-10-12") },
    ],
  );
  assert.equal(rows.length, 2);
  const sara = rows.find((r) => r.phone === "+971500000001")!;
  assert.equal(sara.name, "Sara"); // checkout name wins
  assert.equal(sara.email, "sara@example.com"); // gift fills the missing email
  assert.equal(sara.marketingOk, true);
  assert.equal(sara.gift, "used");
  assert.equal(sara.orders, 3);
  assert.equal(sara.firstSeenAt, d("2026-09-01").toISOString());
  const ali = rows.find((r) => r.phone === "+971500000002")!;
  assert.equal(ali.name, "Ali");
  assert.equal(ali.email, "ali2@example.com"); // newest claim
  assert.deepEqual(ali.giftCodes, ["VIP25", "GIFT15"]);
  assert.equal(ali.gift, "claimed");
  assert.equal(ali.orders, 0);
  // Most recent activity first: Sara ordered on the 20th, Ali claimed on the 12th.
  assert.deepEqual(rows.map((r) => r.phone), ["+971500000001", "+971500000002"]);
});

test("customers: filters", () => {
  const now = d("2026-10-22");
  const base = { name: null, email: null, spentFils: 0, lastOrderId: null, giftCodes: [], firstSeenAt: d("2026-01-01").toISOString() };
  const lapsed = { ...base, phone: "1", orders: 2, lastOrderAt: d("2026-09-01").toISOString(), gift: "none" as const, marketingOk: true };
  const recent = { ...base, phone: "2", orders: 1, lastOrderAt: d("2026-10-15").toISOString(), gift: "none" as const, marketingOk: false };
  const giftOnly = { ...base, phone: "3", orders: 0, lastOrderAt: null, gift: "claimed" as const, marketingOk: false };
  assert.deepEqual([lapsed, recent, giftOnly].filter((r) => matchesFilter(r, "lapsed", now)).map((r) => r.phone), ["1"]);
  assert.deepEqual([lapsed, recent, giftOnly].filter((r) => matchesFilter(r, "marketing", now)).map((r) => r.phone), ["1"]);
  assert.deepEqual([lapsed, recent, giftOnly].filter((r) => matchesFilter(r, "gift_no_order", now)).map((r) => r.phone), ["3"]);
  assert.equal([lapsed, recent, giftOnly].filter((r) => matchesFilter(r, "all", now)).length, 3);
});
