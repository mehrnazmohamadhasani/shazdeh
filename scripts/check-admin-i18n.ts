/*
 * Lists admin strings passed to t("…") that have no Persian entry.
 *
 *   npx tsx scripts/check-admin-i18n.ts
 *
 * Only literal first arguments are checked; t(variable) calls (status
 * labels and the like) are covered by the runtime warning in dev.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FA } from "../src/lib/admin-i18n/fa";

const ROOTS = ["src/app/admin", "src/components/admin", "src/app/login", "src/components/auth"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

const CALL = /\bt\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
const missing = new Map<string, string[]>();

for (const file of ROOTS.flatMap(walk)) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(CALL)) {
    if (m[1] === "`" && m[2].includes("${")) continue;
    const key = m[2].replace(/\\(["'`\\])/g, "$1");
    if (FA[key] === undefined) missing.set(key, [...(missing.get(key) ?? []), file]);
  }
}

if (missing.size === 0) {
  console.log("All admin strings have Persian.");
} else {
  for (const [key, files] of missing) console.log(`${JSON.stringify(key)}  ← ${[...new Set(files)].join(", ")}`);
  console.log(`\n${missing.size} missing.`);
  process.exitCode = 1;
}
