/* eslint-disable no-console */
/**
 * One-off image optimization for the brand asset pack. Resizes JPGs to a
 * reasonable max width and re-encodes at high quality, dropping ~90% of
 * the file size while keeping the dishes looking premium. Idempotent:
 * skips files smaller than the threshold.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd(), "public/menu");
const MAX_WIDTH = 1800;
const QUALITY = 82;
const SKIP_BELOW_BYTES = 1_500_000; // 1.5 MB

async function main() {
  const files = await fs.readdir(ROOT);
  const jpgs = files.filter((f) => /\.(jpe?g)$/i.test(f));

  for (const file of jpgs) {
    const full = path.join(ROOT, file);
    const stat = await fs.stat(full);
    if (stat.size < SKIP_BELOW_BYTES) {
      console.log(`  · skip ${file} (${(stat.size / 1024).toFixed(0)} KB)`);
      continue;
    }
    const buf = await fs.readFile(full);
    const out = await sharp(buf)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();
    await fs.writeFile(full, out);
    console.log(
      `  ✓ ${file}  ${(stat.size / 1024).toFixed(0)} KB → ${(
        out.length / 1024
      ).toFixed(0)} KB`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
