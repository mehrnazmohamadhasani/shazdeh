/*
 * Units of measure as invoices print them ("CTN", "Pcs", "EA", "KGS"),
 * named the same way everywhere: "Carton (CTN)", «کارتن (CTN)». Pure, so
 * it is tested on its own and used by the count screen.
 */

/** Units as invoices print them, by what they mean: [code shown, English, Persian]. */
export const UOM: [RegExp, string, string, string][] = [
  [/^(ctn|ctns|carton|cartons|ct|cs|case|cases|کارتن|كرتون)$/i, "CTN", "Carton", "کارتن"],
  [/^(pkt|pkts|pack|packs|packet|packets|pk)$/i, "PKT", "Packet", "بسته"],
  [/^(box|boxes|bx|جعبه)$/i, "BOX", "Box", "جعبه"],
  [/^(bg|bag|bags|sack|کیسه)$/i, "BAG", "Bag", "کیسه"],
  [/^(tin|tins|can|cans|قوطی)$/i, "TIN", "Tin", "قوطی"],
  [/^(gallon|gallons|gal|گالن)$/i, "GAL", "Gallon", "گالن"],
  [/^(bottle|bottles|btl|بطری)$/i, "BTL", "Bottle", "بطری"],
  [/^(jar|jars)$/i, "JAR", "Jar", "شیشه"],
  [/^(bucket|buckets|tub|tubs|سطل)$/i, "BKT", "Bucket", "سطل"],
  [/^(tray|trays)$/i, "TRAY", "Tray", "سینی"],
  [/^(roll|rolls)$/i, "ROLL", "Roll", "رول"],
  [/^(pc|pcs|pce|pces|piece|pieces|ea|each|nos|no|unit|units|عدد)$/i, "PCE", "Piece", "عدد"],
  [/^(kg|kgs|kilo|kilos|kilogram|kilograms|کیلو|کیلوگرم)$/i, "KGS", "Kilogram", "کیلوگرم"],
  [/^(g|gm|gms|gr|gram|grams|گرم)$/i, "GM", "Gram", "گرم"],
  [/^(l|lt|ltr|ltrs|litre|litres|liter|liters|لیتر)$/i, "LTR", "Litre", "لیتر"],
];
/** "CTN" → "Carton (CTN)"; a code it doesn't know stays as printed, and no unit at all is a pack. */
export function uomName(printed: string, locale: "en" | "fa") {
  const word = printed.trim().replace(/\.$/, "");
  const hit = UOM.find(([re]) => re.test(word));
  if (!hit) return word || (locale === "fa" ? "بسته" : "Pack");
  return `${locale === "fa" ? hit[3] : hit[2]} (${hit[1]})`;
}
