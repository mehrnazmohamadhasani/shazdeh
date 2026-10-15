"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PencilLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, IconButton, Select, StatusPill, TextArea, TextInput } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { messageFromUnknown } from "@/lib/error-message";
import type { RecipeReading } from "@/lib/ops/recipe-reading";
import { cn } from "@/lib/utils";

/*
 * Check a recipe photo before it becomes a draft: choose the recipe it
 * belongs to, then for every line pick the ingredient or prep it is (or
 * create one), fix the amount, or skip it. Lines the AI was unsure of,
 * changed by hand or converted from spoons are marked so nothing slips
 * through. Nothing is approved here.
 */

type Unit = "G" | "ML" | "PCS";
const DB: Record<string, Unit> = { g: "G", ml: "ML", pcs: "PCS" };
const SHORT: Record<Unit, string> = { G: "g", ML: "ml", PCS: "pcs" };

type Named = { id: string; name: string; nameFa: string | null };
type Option = Named & { unit: Unit };
type Match = { type: "ingredient" | "prep"; id: string; via: "learned" | "name" } | null;

type Row = {
  key: number;
  rawName: string;
  printed: string | null;
  flags: { handwritten: boolean; estimated: boolean; unsure: boolean; note: string | null; learned: boolean };
  readUnit: Unit | null;
  /** "i:<id>", "p:<id>", "newi", "newp" or "skip" */
  source: string;
  newName: string;
  newFa: string;
  newUnit: Unit;
  quantity: string;
  wastePct: string;
};

function num(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function RecipeImportForm({
  documentId,
  reading,
  matches,
  target,
  options,
}: {
  documentId: string;
  reading: RecipeReading;
  matches: Match[];
  target: { type: "recipe"; id: string } | { type: "dish"; menuItemId: string } | null;
  options: {
    ingredients: Option[];
    preps: Option[];
    recipes: (Named & { kind: "DISH" | "PREP" })[];
    dishes: Named[];
  };
}) {
  const { t, locale } = useAdminI18n();
  const router = useRouter();
  const label = (o: { name: string; nameFa: string | null }) => (locale === "fa" && o.nameFa ? o.nameFa : o.name);
  const [busy, setBusy] = React.useState(false);

  // ── Where it goes ──
  const [targetValue, setTargetValue] = React.useState(
    target ? (target.type === "recipe" ? `recipe:${target.id}` : `dish:${target.menuItemId}`) : reading.kind === "prep" ? "newprep" : "",
  );
  const [prepName, setPrepName] = React.useState(reading.title ?? "");
  const [prepFa, setPrepFa] = React.useState("");
  const targetKind: "DISH" | "PREP" | null = targetValue.startsWith("dish:")
    ? "DISH"
    : targetValue === "newprep"
      ? "PREP"
      : targetValue.startsWith("recipe:")
        ? (options.recipes.find((r) => r.id === targetValue.slice(7))?.kind ?? null)
        : null;
  const [portions, setPortions] = React.useState(String(reading.portions ?? 1));
  const [yieldQuantity, setYieldQuantity] = React.useState(String(reading.yieldQuantity ?? (reading.yieldUnit === "pcs" ? 1 : 1000)));
  const [yieldUnit, setYieldUnit] = React.useState<Unit>(DB[reading.yieldUnit ?? "g"]);
  const [method, setMethod] = React.useState(
    [reading.method, reading.handwrittenNotes ? `${t("Handwritten notes")}: ${reading.handwrittenNotes}` : null].filter(Boolean).join("\n\n"),
  );

  // ── Lines ──
  const nextKey = React.useRef(reading.lines.length);
  const [rows, setRows] = React.useState<Row[]>(() =>
    reading.lines.map((l, i) => {
      const m = matches[i];
      return {
        key: i,
        rawName: l.name,
        printed: l.printed,
        flags: { handwritten: l.handwritten, estimated: l.estimated, unsure: l.confidence < 0.75, note: l.note, learned: m?.via === "learned" },
        readUnit: l.unit ? DB[l.unit] : null,
        source: m ? `${m.type === "prep" ? "p" : "i"}:${m.id}` : l.isPrep ? "newp" : "newi",
        newName: l.name,
        newFa: l.nameFa ?? "",
        newUnit: l.unit ? DB[l.unit] : "G",
        quantity: l.quantity == null ? "" : String(l.quantity),
        wastePct: "",
      };
    }),
  );
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const optionOf = (source: string): Option | undefined =>
    source.startsWith("i:") ? options.ingredients.find((o) => o.id === source.slice(2)) : source.startsWith("p:") ? options.preps.find((o) => o.id === source.slice(2)) : undefined;
  const unitOf = (r: Row): Unit => optionOf(r.source)?.unit ?? r.newUnit;

  const portionsNum = num(portions) ?? 0;

  async function save() {
    if (!targetValue) throw { error: "Choose which recipe this is" };
    const kept = rows.filter((r) => r.source !== "skip");
    const lines = kept.map((r) => {
      const quantity = num(r.quantity);
      if (quantity == null || quantity <= 0) throw { error: t("Enter an amount for {name}, or skip it", { name: r.rawName || "?" }) };
      const source =
        r.source === "newi" || r.source === "newp"
          ? { type: r.source === "newi" ? "newIngredient" : "newPrep", name: r.newName.trim(), nameFa: r.newFa.trim() || null, unit: r.newUnit }
          : { type: r.source.startsWith("p:") ? "prep" : "ingredient", id: r.source.slice(2) };
      if ("name" in source && !source.name) throw { error: "Give every new item a name" };
      return { rawName: r.rawName, source, quantity, wastePct: num(r.wastePct) ?? 0, note: r.flags.handwritten ? "changed by hand" : null };
    });
    const body = {
      target: targetValue.startsWith("recipe:")
        ? { type: "recipe", recipeId: targetValue.slice(7) }
        : targetValue.startsWith("dish:")
          ? { type: "dish", menuItemId: targetValue.slice(5) }
          : { type: "prep", name: prepName.trim(), nameFa: prepFa.trim() || null },
      portions: targetKind === "DISH" ? portionsNum : 1,
      yieldQuantity: targetKind === "PREP" ? num(yieldQuantity) ?? 0 : 1,
      yieldUnit: targetKind === "PREP" ? yieldUnit : "PCS",
      method: method.trim() || null,
      lines,
    };
    if (targetKind === "DISH" && !(portionsNum > 0)) throw { error: "Enter how many portions the sheet is for" };
    if (targetKind === "PREP" && !(body.yieldQuantity > 0)) throw { error: "Enter how much one batch makes" };
    const res = await fetch(`/api/admin/ops/recipes/import/${documentId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw json;
    return json.recipeId as string;
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        save()
          .then((recipeId) => {
            toast.success(t("Saved as a draft — check it and approve"));
            router.push(`/admin/ops/recipes/${recipeId}`);
            router.refresh();
          })
          .catch((err) => {
            toast.error(t(messageFromUnknown(err, "Could not save")));
            setBusy(false);
          });
      }}
    >
      {/* Where it goes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("This recipe is for")} required className="sm:col-span-2">
          <Select required value={targetValue} onChange={(e) => setTargetValue(e.target.value)}>
            <option value="">{t("Choose…")}</option>
            {options.dishes.length > 0 && (
              <optgroup label={t("Dishes without a recipe")}>
                {options.dishes.map((d) => (
                  <option key={d.id} value={`dish:${d.id}`}>
                    {label(d)}
                  </option>
                ))}
              </optgroup>
            )}
            {options.recipes.length > 0 && (
              <optgroup label={t("Existing recipes (saved as a new draft)")}>
                {options.recipes.map((r) => (
                  <option key={r.id} value={`recipe:${r.id}`}>
                    {label(r)}
                    {r.kind === "PREP" ? ` · ${t("prep")}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            <option value="newprep">{t("A new prep (made in batches, used in dishes)")}</option>
          </Select>
        </Field>
        {targetValue === "newprep" && (
          <>
            <Field label={t("Prep name")} required>
              <TextInput dir="auto" required value={prepName} onChange={(e) => setPrepName(e.target.value)} />
            </Field>
            <Field label={t("Persian name")}>
              <TextInput lang="fa" dir="rtl" value={prepFa} onChange={(e) => setPrepFa(e.target.value)} />
            </Field>
          </>
        )}
        {targetKind === "DISH" && (
          <Field label={t("The amounts on the sheet are for")} hint={t("They are divided by this to get one portion.")}>
            <div className="flex items-center gap-2">
              <TextInput dir="ltr" inputMode="decimal" className="w-28" value={portions} onChange={(e) => setPortions(e.target.value)} />
              <span className="text-[14px] text-dark-grey">{t("portions")}</span>
            </div>
          </Field>
        )}
        {targetKind === "PREP" && (
          <Field label={t("One batch makes")} hint={t("Weigh what comes out of the pot. For “per 1 shank”, enter 1 pcs.")}>
            <div className="flex gap-2">
              <TextInput dir="ltr" inputMode="decimal" className="w-32" value={yieldQuantity} onChange={(e) => setYieldQuantity(e.target.value)} />
              <Select className="w-24" value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value as Unit)}>
                <option value="G">{t("g")}</option>
                <option value="ML">{t("ml")}</option>
                <option value="PCS">{t("pcs")}</option>
              </Select>
            </div>
          </Field>
        )}
      </div>

      {/* Lines */}
      <div className="space-y-3">
        <h3 className="text-[15px] font-semibold">{t("Ingredients on the sheet")}</h3>
        {rows.map((r) => {
          const skipped = r.source === "skip";
          const isNew = r.source === "newi" || r.source === "newp";
          const unit = unitOf(r);
          const mismatch = !skipped && !isNew && r.readUnit && r.readUnit !== unit;
          return (
            <div
              key={r.key}
              className={cn(
                "space-y-3 rounded-[12px] border p-3",
                skipped ? "border-black-iron/[0.06] opacity-55" : r.flags.unsure ? "border-saffron-orange/60 bg-saffron-orange/[0.04]" : "border-black-iron/[0.08]",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
                <span dir="auto" className="font-semibold">{r.rawName || t("Added line")}</span>
                {r.printed && (
                  <span dir="auto" className="text-dark-grey">
                    · {r.printed}
                  </span>
                )}
                {r.flags.handwritten && (
                  <StatusPill tone="accent">
                    <PencilLine className="h-3 w-3" /> {t("changed by hand")}
                  </StatusPill>
                )}
                {r.flags.estimated && <StatusPill tone="warn">{t("amount estimated")}</StatusPill>}
                {r.flags.unsure && <StatusPill tone="warn">{t("check this")}</StatusPill>}
                {r.flags.learned && <StatusPill tone="good">{t("matched from before")}</StatusPill>}
              </div>
              {r.flags.note && (
                <p dir="auto" className="text-[12.5px] text-dark-grey">
                  {r.flags.note}
                </p>
              )}
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                <Select
                  aria-label={t("Ingredient or prep")}
                  className="col-span-3"
                  value={r.source}
                  onChange={(e) => update(r.key, { source: e.target.value })}
                >
                  <option value="newi">{t("+ New ingredient")}</option>
                  <option value="newp">{t("+ New prep")}</option>
                  <option value="skip">{t("Skip this line")}</option>
                  {options.preps.length > 0 && (
                    <optgroup label={t("Preps")}>
                      {options.preps.map((p) => (
                        <option key={p.id} value={`p:${p.id}`}>
                          {label(p)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={t("Ingredients")}>
                    {options.ingredients.map((o) => (
                      <option key={o.id} value={`i:${o.id}`}>
                        {label(o)}
                      </option>
                    ))}
                  </optgroup>
                </Select>
                {!skipped && (
                  <>
                    <div className="flex min-w-0 items-center gap-2">
                      <TextInput
                        dir="ltr"
                        inputMode="decimal"
                        aria-label={t("Amount")}
                        value={r.quantity}
                        onChange={(e) => update(r.key, { quantity: e.target.value })}
                      />
                      {isNew ? (
                        <Select aria-label={t("Unit")} className="w-20 shrink-0" value={r.newUnit} onChange={(e) => update(r.key, { newUnit: e.target.value as Unit })}>
                          <option value="G">{t("g")}</option>
                          <option value="ML">{t("ml")}</option>
                          <option value="PCS">{t("pcs")}</option>
                        </Select>
                      ) : (
                        <span className="text-[13px] text-dark-grey">{t(SHORT[unit])}</span>
                      )}
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <TextInput
                        dir="ltr"
                        inputMode="decimal"
                        aria-label={t("Waste %")}
                        placeholder="0"
                        value={r.wastePct}
                        onChange={(e) => update(r.key, { wastePct: e.target.value })}
                      />
                      <span className="text-[13px] text-dark-grey">%</span>
                    </div>
                  </>
                )}
                <div className={cn("flex justify-end", skipped && "col-start-3")}>
                  <IconButton label={t("Remove line")} danger onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
              {isNew && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <TextInput dir="auto" aria-label={t("Name")} value={r.newName} onChange={(e) => update(r.key, { newName: e.target.value })} placeholder={t("Name")} />
                  <TextInput lang="fa" dir="rtl" aria-label={t("Persian name")} value={r.newFa} onChange={(e) => update(r.key, { newFa: e.target.value })} placeholder={t("Persian name")} />
                </div>
              )}
              {mismatch && (
                <p className="text-[12.5px] text-cinnamon-bark">
                  {t("The sheet gives this in {from}, but it is counted in {to}. Enter the amount in {to}.", { from: t(SHORT[r.readUnit!]), to: t(SHORT[unit]) })}
                </p>
              )}
            </div>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            setRows((rs) => [
              ...rs,
              {
                key: nextKey.current++,
                rawName: "",
                printed: null,
                flags: { handwritten: false, estimated: false, unsure: false, note: null, learned: false },
                readUnit: null,
                source: "newi",
                newName: "",
                newFa: "",
                newUnit: "G",
                quantity: "",
                wastePct: "",
              },
            ])
          }
        >
          <Plus className="h-4 w-4" /> {t("Add line")}
        </Button>
      </div>

      <Field label={t("Method")} hint={t("Steps, timings and quality notes. Kept with the recipe for the kitchen sheet.")}>
        <TextArea dir="auto" rows={8} value={method} onChange={(e) => setMethod(e.target.value)} />
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-black-iron/[0.06] pt-4">
        <p className="me-auto text-[12.5px] text-dark-grey">{t("Saved as a draft. The kitchen standard changes only when you approve it.")}</p>
        <Button type="submit" size="md" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("Save as draft")}
        </Button>
      </div>
    </form>
  );
}
