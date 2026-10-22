import { test } from "node:test";
import assert from "node:assert/strict";
import { giftScanPath, giftStatus, maskEmail, offerLabel } from "../gift-utils";
import { giftCardSvg } from "../gift-card";
import { qrMatrix, qrPath, qrSvg } from "../../qr";

test("gift helpers: short scan link, masked email, offer headline", () => {
  assert.equal(giftScanPath("GIFT15"), "/g/GIFT15");
  assert.equal(maskEmail("maryam.k@gmail.com"), "ma•••@gmail.com");
  assert.equal(maskEmail("a@b.com"), "a•••@b.com");
  assert.equal(maskEmail("broken"), "•••");
  assert.equal(offerLabel("PERCENT", 15), "15% off");
  assert.equal(offerLabel("FIXED", 20), "AED 20 off");
  assert.equal(offerLabel("FREE_DELIVERY", 0), "Free delivery");
});

test("gift status: used wins, then ended, else ready", () => {
  const now = new Date("2026-10-22T10:00:00Z");
  assert.equal(giftStatus({ orderId: "o1" }, { isActive: false, endsAt: null }, now), "used");
  assert.equal(giftStatus({ orderId: null }, { isActive: true, endsAt: "2026-10-01T00:00:00Z" }, now), "expired");
  assert.equal(giftStatus({ orderId: null }, { isActive: false, endsAt: null }, now), "expired");
  assert.equal(giftStatus({ orderId: null }, { isActive: true, endsAt: null }, now), "ready");
});

test("QR: square grid with the three finder patterns, compact path", () => {
  const m = qrMatrix("https://shazdeh.ae/g/GIFT15");
  const n = m.length;
  assert.ok(n >= 21 && (n - 17) % 4 === 0, `size ${n} is a valid QR version`);
  assert.ok(m.every((row) => row.length === n));
  // Finder patterns: dark 7×7 outlines in three corners.
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    assert.ok(m[r][c] && m[r + 6][c + 6] && m[r + 3][c + 3] && !m[r + 1][c + 1]);
  }
  assert.equal(qrPath([[true, true, false, true]]), "M0 0h2v1h-2zM3 0h1v1h-1z");
  const svg = qrSvg("hello", { margin: 4 });
  assert.match(svg, new RegExp(`viewBox="0 0 ${qrMatrix("hello").length + 8} `));
});

test("bag card: offer and A6 size, no small print", () => {
  const svg = giftCardSvg({
    url: "https://shazdeh.ae/g/GIFT15",
    domain: "shazdeh.ae",
    type: "PERCENT",
    value: 15,
  });
  assert.match(svg, /15% off/);
  assert.match(svg, /Nooshe jan!/);
  assert.doesNotMatch(svg, /Minimum order|Valid until/);
  assert.match(svg, /width="105mm" height="148mm"/);
});
