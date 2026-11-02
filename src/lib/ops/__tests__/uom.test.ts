import { test } from "node:test";
import assert from "node:assert/strict";
import { uomName } from "../uom";

// Every unit printed on SHĀZDEH's invoices so far, plus the ones the kitchen uses.
test("units as invoices print them", () => {
  const en = (u: string) => uomName(u, "en");
  for (const u of ["kg", "KG", "KGS", "Kg."]) assert.equal(en(u), "Kilogram (KGS)");
  for (const u of ["Pcs", "PC", "pcs", "PCE", "EA"]) assert.equal(en(u), "Piece (PCE)");
  assert.equal(en("CTN"), "Carton (CTN)");
  assert.equal(en("box"), "Box (BOX)");
  assert.equal(en("BG"), "Bag (BAG)");
  assert.equal(en("PKT"), "Packet (PKT)");
  assert.equal(en("GM"), "Gram (GM)");
  assert.equal(en("L"), "Litre (LTR)");
  assert.equal(en(""), "Pack");
  assert.equal(en("SLV"), "SLV");
});

test("in Persian", () => {
  assert.equal(uomName("CTN", "fa"), "کارتن (CTN)");
  assert.equal(uomName("PKT", "fa"), "بسته (PKT)");
  assert.equal(uomName("KGS", "fa"), "کیلوگرم (KGS)");
  assert.equal(uomName("EA", "fa"), "عدد (PCE)");
  assert.equal(uomName("", "fa"), "بسته");
});
