/*
 * Reading accuracy on real platform receipts (brief §10: report OCR
 * accuracy per document type). Reads every photo listed in
 * docs/ops/samples/platform-receipts/expected.json with the same prompt
 * and schema the app uses, then compares field by field — including the
 * menu dish each line is matched to, using the menu in DATABASE_URL.
 *
 *   npx tsx scripts/eval-platform-receipts.ts [folder]
 *
 * Needs OPENAI_API_KEY (each receipt is one paid call, about US$0.003).
 * The samples are real receipts and stay out of git (docs/ is ignored).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { PLATFORM_PROMPT, platformReadingJsonSchema, platformReadingSchema, type PlatformReading } from "../src/lib/ops/platform-reading";
import { draftFromReading, type MenuEntry } from "../src/lib/ops/platform";

type Expected = {
  file: string;
  platform: string;
  orderNo: string;
  altOrderId: string | null;
  placedAt: string;
  items: { rawName: string; qty: number; lineTotal: number | null; menuItem: string }[];
  subtotal: number | null;
  deliveryFee: number | null;
  serviceFee: number | null;
  discount: number | null;
  total: number;
  customerPhonePrinted?: boolean;
};

const folder = process.argv[2] ?? "docs/ops/samples/platform-receipts";
const { receipts } = JSON.parse(readFileSync(join(folder, "expected.json"), "utf8")) as { receipts: Expected[] };

async function read(file: string): Promise<PlatformReading> {
  const data = readFileSync(join(folder, file));
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5-mini",
      instructions: PLATFORM_PROMPT,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Read this receipt." },
            { type: "input_image", image_url: `data:image/jpeg;base64,${data.toString("base64")}`, detail: "high" },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "platform_receipt", schema: platformReadingJsonSchema, strict: true } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[] };
  const text = (body.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []).find((c) => c.type === "output_text")?.text;
  return platformReadingSchema.parse(JSON.parse(text ?? "null"));
}

async function loadMenu(): Promise<(MenuEntry & { label: string })[]> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const { rows } = await db.query(
    `SELECT m.id, m.name, m.price, m."isVegetarian", c.name AS category FROM "MenuItem" m JOIN "Category" c ON c.id = m."categoryId" WHERE m."isActive" ORDER BY c."order", m."order"`,
  );
  await db.end();
  return rows.map((r) => ({ id: r.id, name: r.name, category: r.category, priceFils: Math.round(r.price * 100), isVegetarian: r.isVegetarian, label: `${r.category} / ${r.name}` }));
}

const same = (a: number | null | undefined, b: number | null | undefined) => (a ?? null) === (b ?? null) || (a != null && b != null && Math.abs(a - b) < 0.005);

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("Set OPENAI_API_KEY to run the evaluation.");
  const menu = await loadMenu();
  const score = new Map<string, { ok: number; all: number }>();
  const tally = (field: string, ok: boolean) => {
    const s = score.get(field) ?? { ok: 0, all: 0 };
    s.all++;
    if (ok) s.ok++;
    score.set(field, s);
  };

  for (const exp of receipts) {
    const r = await read(exp.file);
    const d = draftFromReading(r, menu, () => []);
    const misses: string[] = [];
    const check = (field: string, ok: boolean, got: unknown) => {
      tally(field, ok);
      if (!ok) misses.push(`${field}=${JSON.stringify(got)}`);
    };
    check("platform", d.channelCode === exp.platform, d.channelCode);
    check("orderNo", d.orderNo === exp.orderNo, d.orderNo);
    check("altOrderId", (d.altOrderId ?? null) === exp.altOrderId, d.altOrderId);
    // Order times are kept to the minute (the review screen edits HH:mm).
    check("placedAt", d.placedAt?.slice(0, 16) === new Date(exp.placedAt).toISOString().slice(0, 16), r.placedAt);
    check("itemCount", d.items.length === exp.items.length, d.items.length);
    exp.items.forEach((ei, i) => {
      const di = d.items[i];
      check("item.qty", di?.quantity === ei.qty, di?.quantity);
      check("item.lineTotal", same(r.items[i]?.lineTotal, ei.lineTotal), r.items[i]?.lineTotal);
      const matched = menu.find((m) => m.id === di?.match?.menuItemId)?.label ?? null;
      check("item.menuDish", matched === ei.menuItem, `${di?.rawName} → ${matched}`);
      check("item.confident", !!di?.match?.confident, `${di?.rawName} not confident`);
    });
    for (const f of ["subtotal", "deliveryFee", "serviceFee", "total"] as const) check(f, same(r[f], exp[f]), r[f]);
    check("discount", same(r.discount ?? 0, exp.discount ?? 0), r.discount);
    // Privacy: a printed phone number must never come through.
    const leaked = /\+?\d[\d\s-]{8,}/.test(JSON.stringify({ ...r, otherNumbers: [] }).replace(/"\d{4}-\d{2}-\d{2}T[\d:]+"/g, ""));
    check("noPhone", !leaked, "phone-like number in reading");
    console.log(`${misses.length ? "✗" : "✓"} ${exp.file}${misses.length ? `  ${misses.join("  ")}` : ""}`);
  }

  console.log("\nField accuracy");
  let ok = 0;
  let all = 0;
  for (const [field, s] of score) {
    ok += s.ok;
    all += s.all;
    console.log(`  ${field.padEnd(16)} ${s.ok}/${s.all}`);
  }
  console.log(`  ${"all fields".padEnd(16)} ${ok}/${all} (${((ok / all) * 100).toFixed(1)} %)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
