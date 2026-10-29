import { test } from "node:test";
import assert from "node:assert/strict";
import { countTime } from "../stock-count";

// 2026-10-29 15:30 in Dubai.
const NOW = new Date("2026-10-29T11:30:00Z");

test("a count for today is taken now", () => {
  assert.equal(countTime("2026-10-29", NOW)?.toISOString(), NOW.toISOString());
});

test("a count for an earlier day is taken at the end of that Dubai day", () => {
  assert.equal(countTime("2026-10-28", NOW)?.toISOString(), "2026-10-28T19:59:59.999Z");
});

test("today follows Dubai, not UTC", () => {
  // 2026-10-29 01:00 in Dubai is still the 28th in UTC.
  const early = new Date("2026-10-28T21:00:00Z");
  assert.equal(countTime("2026-10-29", early)?.toISOString(), early.toISOString());
  assert.equal(countTime("2026-10-30", early), null);
});

test("a future day or a non-date is refused", () => {
  assert.equal(countTime("2026-10-30", NOW), null);
  assert.equal(countTime("29/10/2026", NOW), null);
  assert.equal(countTime("2026-13-01", NOW), null);
});
