/**
 * Renders the "on its way" scooter (src/components/order/scooter-art.ts)
 * to the PNGs that push notifications and emails need:
 *
 *   npx tsx scripts/generate-push-icons.ts
 *
 *   public/icons/on-the-way.png        192px, full colour on cream — the
 *                                      notification's large icon and the
 *                                      email illustration
 *   public/icons/badge-on-the-way.png  96px, white on transparent — Android
 *                                      status-bar badge (must be monochrome)
 */
import path from "node:path";
import sharp from "sharp";
import { scooterSvg } from "../src/components/order/scooter-art";

const OUT = path.resolve("public/icons");

const colour = scooterSvg(
  { body: "#ce4927", wheel: "#1d1d1b", rim: "#1d1d1b", box: "#1d1d1b", mark: "#fdf6ec", light: "#d68a64" },
  { size: 192, background: "#fdf6ec" },
);
const white = "#ffffff";
const badge = scooterSvg(
  { body: white, wheel: "transparent", rim: white, box: white, mark: "transparent", light: white },
  { size: 96 },
);

async function main() {
  await sharp(Buffer.from(colour)).png({ compressionLevel: 9 }).toFile(path.join(OUT, "on-the-way.png"));
  await sharp(Buffer.from(badge)).png({ compressionLevel: 9 }).toFile(path.join(OUT, "badge-on-the-way.png"));
  console.log("Wrote on-the-way.png and badge-on-the-way.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
