import { test } from "node:test";
import assert from "node:assert/strict";
import { STUCK_MS, canReadAgain } from "../document-state";

/* The same photo uploaded again: which stored documents may be read again. */

const now = new Date("2026-10-15T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

test("discarded and failed documents can be read again", () => {
  assert.equal(canReadAgain({ status: "DISCARDED", updatedAt: ago(1000) }, now), true);
  assert.equal(canReadAgain({ status: "FAILED", updatedAt: ago(1000) }, now), true);
});

test("saved and waiting-for-review documents are left alone", () => {
  assert.equal(canReadAgain({ status: "SAVED", updatedAt: ago(STUCK_MS * 10) }, now), false);
  assert.equal(canReadAgain({ status: "NEEDS_REVIEW", updatedAt: ago(STUCK_MS * 10) }, now), false);
});

test("a reading in progress only counts as stuck after the time limit", () => {
  assert.equal(canReadAgain({ status: "PROCESSING", updatedAt: ago(60_000) }, now), false);
  assert.equal(canReadAgain({ status: "PROCESSING", updatedAt: ago(STUCK_MS + 1) }, now), true);
});
