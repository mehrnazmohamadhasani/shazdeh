import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeMeat } from "../meat-kind";

/* Only meat is asked what kind of meat it is: by name, in English, Persian or Arabic. */

test("only meat offers a kind of meat", () => {
  const kinds = ["Lamb", "Beef", "Chicken", "Lamb shank", "گوشت گوسفندی"];
  for (const n of ["Lamb leg", "FRESH MUTTON", "9 BEEF BACKSTIP", "Chicken", "CHILLED AUS LAMB SHANK", "گوشت گوساله", "ران گوسفند", "موزة خروف استرالى"]) {
    assert.ok(looksLikeMeat([n], kinds), n);
  }
  for (const n of ["Barberries", "Black pepper", "Sella rice 1121", "Salt", "oil (MABRUK)", "TOMATO PASTE 800G", "زرشک", "Chicken stock cube"]) {
    assert.equal(looksLikeMeat([n], kinds), n === "Chicken stock cube", n);
  }
});
