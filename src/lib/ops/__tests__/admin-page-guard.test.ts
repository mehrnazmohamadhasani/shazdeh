import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * The admin layout does not re-render on client-side navigation, so every
 * admin page must check the signed-in user itself (requireAdmin re-reads
 * the account and role from the database). Pages that only redirect are fine.
 */
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pages(join(dir, e.name)) : e.name === "page.tsx" ? [join(dir, e.name)] : [],
  );
}

test("every admin page calls requireAdmin (or only redirects)", () => {
  const missing = pages(join(process.cwd(), "src/app/admin")).filter((file) => {
    const src = readFileSync(file, "utf8");
    if (/requireAdmin\(\)/.test(src)) return false;
    const onlyRedirects = !/prisma|from "@\/lib\/ops|from "@\/lib\/ordering/.test(src) && /redirect\(/.test(src);
    return !onlyRedirects;
  });
  assert.deepEqual(missing, []);
});
