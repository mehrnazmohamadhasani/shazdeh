import { test } from "node:test";
import assert from "node:assert/strict";
import { choosePack, packFromBase, packOptions, packStock, perUnit, readPack, unitWord, type Pack } from "../pack";

// Lines as printed on SHĀZDEH's real invoices.
const line = (description: string, unit: string | null, packSize: string | null = null) => ({ description, unit, packSize });
const amounts = (options: Pack[]) => options.map((p) => `${perUnit(p).amount} ${perUnit(p).base}`);

test("printed units, in any spelling or language", () => {
  assert.equal(unitWord("KGS"), "kg");
  assert.equal(unitWord("Ltr."), "l");
  assert.equal(unitWord("LB"), "lb");
  assert.equal(unitWord("PCE"), "pcs");
  assert.equal(unitWord("عدد"), "pcs");
  assert.equal(unitWord("کیلو"), "kg");
  assert.equal(unitWord("CTN"), null);
});

test("a quantity already in kilos is the amount", () => {
  assert.deepEqual(amounts(packOptions(line("White Onion", "kg"))), ["1000 g"]);
  // Chicken: 45 KG, whatever the packing column says.
  assert.deepEqual(amounts(packOptions(line("Chicken 1500G Brazil 8X1500G Chicken Whole-FZN", "KG", "10X1500G"))), ["1000 g"]);
});

test("butchers print no unit: meat is by the kilo", () => {
  assert.deepEqual(amounts(packOptions(line("01 FRESH MUTTON", null), { meat: true })), ["1000 g"]);
  assert.deepEqual(packOptions(line("01 FRESH MUTTON", null)), []);
});

test("a size in the name", () => {
  assert.deepEqual(amounts(packOptions(line("PAMCHAL TOMATO PASTE GLASS BOTTLE 700G", "Pcs"))), ["700 g"]);
  assert.deepEqual(amounts(packOptions(line("BAY LEAVES 25GM", "PC"))), ["25 g"]);
  assert.deepEqual(amounts(packOptions(line("Yogurt Seven 9kg bucket full", "PC"))), ["9000 g"]);
  assert.deepEqual(amounts(packOptions(line("Willie Creamy cheese 1 K gr ex", "PC"))), ["1000 g"]);
  assert.deepEqual(amounts(packOptions(line("FROZEN BROAD BEANS 400G - 20 X 1-SLV", "Pcs"))), ["400 g"]);
});

test("pounds and litres become grams (1 L = 1 kg)", () => {
  assert.deepEqual(amounts(packOptions(line("OIL CANOLA CLEAR FRY 35 LB 'SUPER CHEF'", "PCE"))), ["15876 g"]);
  assert.deepEqual(amounts(packOptions(line("ORGANIC SOU COCONUT WATER 1L", "PC"))), ["1000 g"]);
  assert.deepEqual(amounts(packOptions(line("TAKSA VERJUICE 500CC", "Pcs"))), ["500 g"]);
});

test("a carton holds the count; a piece is one of them", () => {
  assert.deepEqual(amounts(packOptions(line("Supreme Dish Wash 4X5L Supreme Hygiene", "CTN", "4X5L"))), ["20000 g", "5000 g"]);
  assert.deepEqual(amounts(packOptions(line("SUPREME HAND WASH LAVANDER 4X5LTR", "PCE"))), ["5000 g", "20000 g"]);
  assert.deepEqual(amounts(packOptions(line("Sd Soda Water Schweppes 24X300ML", "CTN", "24X300ML"))), ["7200 g", "300 g"]);
  assert.deepEqual(amounts(packOptions(line("TABLE SALT 12X1 KGS", "PKT"))), ["1000 g", "12000 g"]);
});

test("size × count, as some suppliers print it", () => {
  assert.deepEqual(amounts(packOptions(line("SABRA SALTED BUTTER 2500G X 6 PCS", "Pcs"))), ["2500 g", "15000 g"]);
});

test("countable things in a carton", () => {
  assert.deepEqual(amounts(packOptions(line("LATEX GLOVES POWDER FREE (L), 10 X 100", "CTN"))), ["1000 pcs", "100 pcs"]);
  assert.deepEqual(amounts(packOptions(line("StPlant Starch Bio Cutlery Set 1 X 250", "CTN", "1X250"))), ["250 pcs"]);
  // Sizes in cm are not packs.
  assert.deepEqual(amounts(packOptions(line("Kraft Bags W Twisted Handle 35X32X18CM", "CTN", "1X200"))), ["200 pcs"]);
  assert.deepEqual(amounts(packOptions(line("GARBAGE BAG BLACK 110 X 130 CM, 1 X 20 KG", "BAG"))), ["20000 g"]);
  assert.deepEqual(amounts(packOptions(line("SANGAK", "pcs"))), ["1 pcs"]);
});

test("nothing says what one unit holds: ask", () => {
  assert.deepEqual(packOptions(line("Beans", "ct")), []);
  assert.deepEqual(packOptions(line("Dates", "box")), []);
});

test("several inner levels", () => {
  const dates: Pack = { inner: [{ count: 12, name: "baste" }], amount: 20, unit: "pcs" };
  assert.deepEqual(packStock(10, dates), { base: "pcs", amount: 2400 });
  const byWeight: Pack = { inner: [{ count: 12, name: "baste" }], amount: 550, unit: "g" };
  assert.deepEqual(packStock(10, byWeight), { base: "g", amount: 66000 });
});

test("the last price picks the pack, and says when it is unsure", () => {
  const butter = packOptions(line("SABRA SALTED BUTTER 2500G X 6 PCS", "Pcs"));
  // Last time butter cost 3.8 fils per gram (38 AED/kg): 4 tubs of 2.5 kg for 380 AED fits.
  const known = choosePack(butter, 4, 380, 3.8);
  assert.equal(perUnit(known.pack!).amount, 2500);
  assert.equal(known.sure, true);
  // No price to compare with: the first guess, but a person checks.
  assert.equal(choosePack(butter, 4, 380, null).sure, false);
  // A single possible pack needs no price.
  assert.equal(choosePack(packOptions(line("BAY LEAVES 25GM", "PC")), 3, 8.43, null).sure, true);
  assert.deepEqual(choosePack([], 2, 50, null), { pack: null, sure: false });
});

test("old memory and stored packs", () => {
  assert.deepEqual(packFromBase(40000, "g"), { inner: [], amount: 40, unit: "kg" });
  assert.deepEqual(packFromBase(240, "pcs"), { inner: [], amount: 240, unit: "pcs" });
  assert.equal(readPack({ inner: [], amount: 0, unit: "kg" }), null);
  assert.equal(readPack(null), null);
});
