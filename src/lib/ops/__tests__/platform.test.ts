import { test } from "node:test";
import assert from "node:assert/strict";
import { aliasKey, checkPlatformDraft, draftFromReading, dubaiTimestamp, estimateFees, foodSales, matchDish, type MenuEntry } from "../platform";
import { samplePlatformReading, type PlatformReading } from "../platform-reading";

/*
 * Dish names, prices and layouts from real SHĀZDEH platform receipts
 * (talabat, Careem, Deliveroo, Noon Food — 9 receipts, 9–11 Oct 2026),
 * matched against the seeded menu.
 */

const m = (id: string, name: string, category: string, price: number, isVegetarian = false): MenuEntry => ({ id, name, category, priceFils: price * 100, isVegetarian });
const MENU: MenuEntry[] = [
  m("gheimeh", "Gheimeh Bademjan", "Main Dishes", 128),
  m("ghormeh", "Ghormeh Sabzi", "Main Dishes", 128),
  m("karafs", "Karafs", "Main Dishes", 138),
  m("loobia", "Loobia Polo", "Main Dishes", 128),
  m("baghali", "Baghali Polo ba Mahiche", "Main Dishes", 138),
  m("zereshk", "Zereshk Polo Morgh", "Main Dishes", 98),
  m("fesenjan", "Fesenjan", "Main Dishes", 118),
  m("kabab", "Kabab Digi", "Main Dishes", 118),
  m("adas", "Adas Polo", "Main Dishes", 108),
  m("morgh-bademjan", "Morgh Bademjan", "Main Dishes", 98),
  m("makaroni", "Makaroni", "Main Dishes", 98),
  m("mix", "SHĀZDEH Mix", "Main Dishes", 98),
  m("tahchin-ghormeh", "Ghormeh Sabzi Tahchin", "Main Dishes", 98),
  m("tahchin-gheimeh", "Gheimeh Bademjan Tahchin", "Main Dishes", 98),
  m("tahchin-karafs", "Karafs Tahchin", "Main Dishes", 98),
  m("tahchin-zereshk", "Zereshk Polo Tahchin", "Main Dishes", 88),
  m("tahchin-baghali", "Baghali Polo Tahchin", "Main Dishes", 115),
  m("tahchin-kabab", "Kabab Digi Tahchin", "Main Dishes", 99),
  m("veg-gheimeh", "Gheimeh Bademjan", "Vegetarian", 98, true),
  m("veg-ghormeh", "Ghormeh Sabzi", "Vegetarian", 98, true),
  m("veg-karafs", "Karafs", "Vegetarian", 98, true),
  m("veg-loobia", "Loobia Polo", "Vegetarian", 88, true),
  m("kashke", "Kashke Bademjan", "Vegetarian", 44, true),
  m("mast-bademjan", "Mast Bademjan", "Sides", 36),
  m("mast-khiar", "Mast Khiar", "Sides", 29),
  m("shirazi", "Salad Shirazi", "Sides", 36),
  m("sabzi-large", "Sabzi Khordan — Large", "Sides", 38),
  m("sabzi-small", "Sabzi Khordan — Small", "Sides", 25),
  m("khiar-sekanjabin", "Khiar Sekanjabin", "Drinks", 36),
  m("lemonade", "Lemonade", "Drinks", 34),
];

const cases: [name: string, category: string | null, priceAed: number | null, expected: string][] = [
  ["Makaroni", null, 98, "makaroni"], // talabat
  ["MAKARONI Large Portion", null, 98, "makaroni"], // Noon Food
  ["Vegetarian Ghormeh Sabzi Large", null, 98, "veg-ghormeh"], // talabat
  ["Ghormeh Sabzi Large", null, 128, "ghormeh"], // talabat: the meat dish
  ["SHIRAZI SALAD", null, 36, "shirazi"], // words in another order
  ["KHIAR SEKANJABIN", null, 36, "khiar-sekanjabin"],
  ["Gheymeh Bademjan", "VEGETARIAN", 98, "veg-gheimeh"], // Careem: other spelling, vegetarian heading
  ["Zereshk Polo Tahchin", null, 88, "tahchin-zereshk"],
  ["Karafs Tahchin", null, 98, "tahchin-karafs"],
  ["Fesenjan", "MAIN DISHES (1)", null, "fesenjan"], // Deliveroo: no prices
  ["Sabzi Khordan Small", "SIDES (1)", null, "sabzi-small"],
  ["Zereshk Polo", "MAIN DISHES (1)", 98, "zereshk"], // Deliveroo single dish: price from the total
];

test("receipt dish names match the menu", () => {
  for (const [name, category, price, expected] of cases) {
    const got = matchDish({ name, category, unitPriceFils: price == null ? null : price * 100 }, MENU);
    assert.equal(got?.menuItemId, expected, `${name} → ${got?.menuItemId}`);
    assert.equal(got?.confident, true, `${name} should be a clear match`);
  }
});

test("an ambiguous name is matched but not marked confident", () => {
  // Deliveroo prints no price; "Zereshk Polo" could be Morgh (98) or Tahchin (88).
  const got = matchDish({ name: "Zereshk Polo", category: "MAIN DISHES", unitPriceFils: null }, MENU);
  assert.equal(got?.confident, false);
  assert.equal(matchDish({ name: "Pizza Margherita", category: null, unitPriceFils: 4500 }, MENU), null);
});

test("a confirmed name wins next time, this platform first", () => {
  const key = aliasKey("Zereshk Polo", "MAIN DISHES (1)");
  assert.equal(key, "zereshk polo | main dishes");
  const got = matchDish({ name: "Zereshk Polo", category: "MAIN DISHES (1)", unitPriceFils: null }, MENU, [
    { key, menuItemId: "tahchin-zereshk", sameChannel: false },
    { key, menuItemId: "zereshk", sameChannel: true },
  ]);
  assert.deepEqual(got, { menuItemId: "zereshk", via: "learned", confident: true });
});

test("Dubai times and business days", () => {
  assert.deepEqual(dubaiTimestamp("2026-10-09T20:42"), { placedAt: new Date("2026-10-09T16:42:00Z"), businessDate: "2026-10-09" });
  assert.equal(dubaiTimestamp("2026-10-10T19:56:27")!.placedAt.toISOString(), "2026-10-10T15:56:27.000Z");
  assert.equal(dubaiTimestamp("9 Oct"), null);
});

const reading = (over: Partial<PlatformReading>): PlatformReading => ({ ...samplePlatformReading(), ...over });
const noAliases = () => [];

test("talabat: order IDs, food sales and fees that add up", () => {
  const d = draftFromReading(reading({}), MENU, noAliases);
  assert.equal(d.channelCode, "talabat");
  assert.equal(d.orderNo, "2309");
  assert.equal(d.altOrderId, "3946878509");
  assert.equal(d.businessDate, "2026-10-09");
  assert.equal(d.items[0].match?.menuItemId, "makaroni");
  // SHĀZDEH sold 98.00; the customer paid 90.20 after fees and a discount.
  const sales = foodSales({ ...d, items: d.items.map((i) => ({ ...i, menuPriceFils: 9800 })) });
  assert.deepEqual(sales, { fils: 9800, source: "printed" });
  const flags = checkPlatformDraft(
    { ...d, items: d.items.map((i) => ({ ...i, menuItemId: i.match?.menuItemId ?? null, menuPriceFils: 9800, confident: !!i.match?.confident })) },
    { now: new Date("2026-10-15T00:00:00Z"), itemCount: 1 },
  );
  assert.deepEqual(flags.map((f) => f.field), ["discount"]); // only: who funds the discount
});

test("talabat: a misread total is flagged, not fixed", () => {
  const d = draftFromReading(reading({ total: 98.2 }), MENU, noAliases);
  const flags = checkPlatformDraft({ ...d, items: d.items.map((i) => ({ ...i, menuItemId: "makaroni", menuPriceFils: 9800, confident: true })) }, { now: new Date("2026-10-15T00:00:00Z") });
  assert.ok(flags.some((f) => f.field === "total" && f.message.includes("90.20")));
});

test("Deliveroo: no line prices — the total is the food sale, the menu must agree", () => {
  const r = reading({
    platform: "deliveroo",
    orderNo: "4649",
    otherNumbers: [],
    placedAt: "2026-10-11T13:58",
    items: [
      { name: "Fesenjan", category: "MAIN DISHES (1)", quantity: 1, lineTotal: null, note: null, confidence: 0.95 },
      { name: "Sabzi Khordan Small", category: "SIDES (1)", quantity: 1, lineTotal: null, note: null, confidence: 0.95 },
    ],
    subtotal: null,
    deliveryFee: null,
    serviceFee: null,
    discount: null,
    total: 143,
    itemCount: 2,
  });
  const d = draftFromReading(r, MENU, noAliases);
  assert.deepEqual(d.items.map((i) => i.match?.menuItemId), ["fesenjan", "sabzi-small"]);
  const priced = d.items.map((i) => ({ ...i, menuItemId: i.match!.menuItemId, menuPriceFils: MENU.find((x) => x.id === i.match!.menuItemId)!.priceFils, confident: true }));
  assert.deepEqual(foodSales({ ...d, items: priced }), { fils: 14300, source: "printed" });
  assert.deepEqual(checkPlatformDraft({ ...d, items: priced }, { now: new Date("2026-10-15T00:00:00Z"), itemCount: 2 }), []);
  // A wrong dish shows up as menu prices that don't make the total.
  const wrong = priced.map((i, n) => (n === 1 ? { ...i, menuPriceFils: 3800 } : i));
  assert.ok(checkPlatformDraft({ ...d, items: wrong }, { now: new Date("2026-10-15T00:00:00Z") }).some((f) => f.message.includes("156.00")));
});

test("Deliveroo single dish takes its price from the total", () => {
  const r = reading({
    platform: "deliveroo",
    orderNo: "1997",
    otherNumbers: [],
    items: [{ name: "Zereshk Polo", category: "MAIN DISHES (1)", quantity: 1, lineTotal: null, note: null, confidence: 0.95 }],
    subtotal: null,
    deliveryFee: null,
    serviceFee: null,
    discount: null,
    total: 98,
  });
  const d = draftFromReading(r, MENU, noAliases);
  assert.equal(d.items[0].lineTotalFils, 9800);
  assert.deepEqual(d.items[0].match, { menuItemId: "zereshk", via: "name", confident: true });
});

test("Careem: the # number is the order, the large one the other ID", () => {
  const d = draftFromReading(reading({ platform: "careem", orderNo: "#17387", otherNumbers: ["9509", "17387"] }), MENU, noAliases);
  assert.equal(d.orderNo, "17387");
  assert.equal(d.altOrderId, "9509");
});

test("customer: first name only", () => {
  assert.equal(draftFromReading(reading({ customerFirstName: "Mohammad Najdi" }), MENU, noAliases).customerFirstName, "Mohammad");
});

test("fees: unknown without a rule, estimated with one", () => {
  assert.equal(estimateFees(null, 9800), null);
  assert.deepEqual(estimateFees({ commissionPct: 25, paymentFeePct: 2, fixedFeeFils: null, vatOnFees: true }, 9800), {
    commissionFils: 2450,
    paymentFeeFils: 196,
    fixedFeeFils: 0,
    vatFils: 132,
    totalFils: 2778,
  });
});
