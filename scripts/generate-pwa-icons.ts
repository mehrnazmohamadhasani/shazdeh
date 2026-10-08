/**
 * Generates the PWA / home-screen icon set from the brand app icon.
 *
 *   npm run icons:pwa
 *
 * The source tile has transparent rounded corners. That is right for
 * "any" icons (desktop shelves show the shape as drawn), but iOS fills
 * transparency with black and Android masks icons itself, so the
 * apple-touch and maskable icons are flattened onto the tile colour and
 * — for maskable — inset so the glyph stays inside the 80% safe-zone circle.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE = path.resolve("brand-assets/app-icon-source.png");
const OUT = path.resolve("public/icons");
// Sampled from the source tile (#bc442c).
const TILE = { r: 188, g: 68, b: 44, alpha: 1 };

// The square inside the source's rounded corners (1024px source): it
// still contains the whole glyph but none of the anti-aliased rim.
const INNER = { left: 110, top: 110, width: 804, height: 804 };
// INNER as a share of the full tile — keeps the glyph at its drawn size.
const NATIVE_SCALE = INNER.width / 1024;

async function fullBleed(size: number, glyphScale = NATIVE_SCALE) {
  const inner = Math.round(size * glyphScale);
  const glyph = await sharp(SOURCE)
    .extract(INNER)
    .flatten({ background: TILE })
    .resize(inner, inner)
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: TILE },
  })
    .composite([{ input: glyph, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  for (const size of [192, 512]) {
    await sharp(SOURCE)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, `icon-${size}.png`));
    await fs.writeFile(
      path.join(OUT, `maskable-${size}.png`),
      await fullBleed(size, 0.8),
    );
  }

  // iOS rounds the corners itself; transparency would render black.
  const apple = await fullBleed(180);
  await fs.writeFile(path.join(OUT, "apple-touch-icon.png"), apple);
  await fs.writeFile(path.resolve("src/app/apple-icon.png"), apple);

  console.log("✓ PWA icons written to public/icons and src/app/apple-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
