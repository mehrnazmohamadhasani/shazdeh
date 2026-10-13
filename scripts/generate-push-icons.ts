/**
 * Renders the "on its way" scooter (src/components/order/scooter-art.ts)
 * to the images it needs:
 *
 *   npx tsx scripts/generate-push-icons.ts
 *
 *   public/brand/s-glyph.png           the brand "S" cut from the app icon
 *                                      (white on transparent) — printed on
 *                                      the scooter's package
 *   public/icons/on-the-way.png        192px, full colour on cream — the
 *                                      notification's large icon and the
 *                                      email illustration
 *   public/icons/badge-on-the-way.png  96px, white on transparent — Android
 *                                      status-bar badge (must be monochrome)
 */
import path from "node:path";
import sharp from "sharp";
import { scooterSvg } from "../src/components/order/scooter-art";

const APP_ICON = path.resolve("brand-assets/app-icon-source.png");
// Same inner square as scripts/generate-pwa-icons.ts: the glyph without
// the tile's anti-aliased rounded rim.
const INNER = { left: 110, top: 110, width: 804, height: 804 };
// Tile green channel (#bc442c → 68) vs the white glyph (255).
const TILE_G = 68;

async function sGlyph() {
  const alpha = await sharp(APP_ICON)
    .extract(INNER)
    .extractChannel("green")
    .linear(255 / (255 - TILE_G), (-TILE_G * 255) / (255 - TILE_G))
    .raw()
    .toBuffer();
  const white = await sharp({ create: { width: INNER.width, height: INNER.height, channels: 3, background: "#ffffff" } })
    .joinChannel(alpha, { raw: { width: INNER.width, height: INNER.height, channels: 1 } })
    .png()
    .toBuffer();
  return sharp(white).trim().resize({ height: 256 }).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  const glyph = await sGlyph();
  await sharp(glyph).toFile(path.resolve("public/brand/s-glyph.png"));
  const glyphHref = `data:image/png;base64,${glyph.toString("base64")}`;

  const colour = scooterSvg(
    { body: "#d68a64", wheel: "#1d1d1b", rim: "#1d1d1b", box: "#ce4927", mark: "#fdf6ec", light: "#ce4927" },
    { size: 192, background: "#fdf6ec", glyphHref },
  );
  const white = "#ffffff";
  const badge = scooterSvg(
    { body: white, wheel: "transparent", rim: white, box: white, mark: white, light: white },
    { size: 96, glyphHref },
  );

  await sharp(Buffer.from(colour)).png({ compressionLevel: 9 }).toFile(path.resolve("public/icons/on-the-way.png"));
  await sharp(Buffer.from(badge)).png({ compressionLevel: 9 }).toFile(path.resolve("public/icons/badge-on-the-way.png"));
  console.log("Wrote s-glyph.png, on-the-way.png and badge-on-the-way.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
