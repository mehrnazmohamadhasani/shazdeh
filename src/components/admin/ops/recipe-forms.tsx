"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, IconButton, Select, TextInput } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { amountText } from "@/components/admin/ops/format";
import { messageFromUnknown } from "@/lib/error-message";
import { dishMargin, grossQuantity } from "@/lib/ops/recipe-cost";
import type { BaseUnit } from "@/lib/ops/units";
import { cn } from "@/lib/utils";

/*
 * Recipe screens: start a recipe, edit the draft with a live cost, approve
 * it, and read the approved version scaled to any batch size. Amounts are
 * typed in g / ml / pcs — the units recipes are written in.
 */

type Unit = "G" | "ML" | "PCS";
const BASE: Record<Unit, BaseUnit> = { G: "g", ML: "ml", PCS: "pcs" };

export type SourceOption = { id: string; name: string; nameFa: string | null; unit: Unit; filsPerUnit: number | null };

function num(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

async function send(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json as Record<string, unknown>;
}

function useBusy() {
  const { t } = useAdminI18n();
  const [busy, setBusy] = React.useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Could not save")));
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

function UnitLabel({ unit }: { unit: Unit }) {
  const { t } = useAdminI18n();
  return <span className="text-[13px] text-dark-grey">{t(BASE[unit])}</span>;
}

// ─── Starting a recipe ──────────────────────────────────────────────────────

export function NewDishRecipeButton({ menuItemId }: { menuItemId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const { busy, run } = useBusy();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() =>
        run(async () => {
          const json = await send("/api/admin/ops/recipes", "POST", { kind: "DISH", menuItemId, name: null, nameFa: null, yieldUnit: "PCS" });
          router.push(`/admin/ops/recipes/${json.id}`);
        })
      }
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("Add recipe")}
    </Button>
  );
}

export function NewPrepForm() {
  const { t } = useAdminI18n();
  const router = useRouter();
  const { busy, run } = useBusy();
  const [name, setName] = React.useState("");
  const [nameFa, setNameFa] = React.useState("");
  const [unit, setUnit] = React.useState<Unit>("G");
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const json = await send("/api/admin/ops/recipes", "POST", { kind: "PREP", menuItemId: null, name, nameFa, yieldUnit: unit });
          router.push(`/admin/ops/recipes/${json.id}`);
        });
      }}
    >
      <Field label={t("Name")} required>
        <TextInput dir="auto" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. {example}", { example: "Cooked rice" })} />
      </Field>
      <Field label={t("Persian name")}>
        <TextInput lang="fa" dir="rtl" value={nameFa} onChange={(e) => setNameFa(e.target.value)} placeholder="برنج پخته" />
      </Field>
      <Field label={t("Measured in")}>
        <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
          <option value="G">{t("g")}</option>
          <option value="ML">{t("ml")}</option>
          <option value="PCS">{t("pcs")}</option>
        </Select>
      </Field>
      <Button type="submit" size="md" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("New prep")}
      </Button>
    </form>
  );
}

// ─── Draft editor ───────────────────────────────────────────────────────────

type Row = { key: number; source: string; quantity: string; wastePct: string; note: string | null };

export function DraftEditor({
  recipeId,
  kind,
  initial,
  options,
  menuPriceAed,
  canApprove,
  startsNewVersion,
}: {
  recipeId: string;
  kind: "DISH" | "PREP";
  initial: {
    yieldQuantity: number;
    yieldUnit: Unit;
    note: string | null;
    lines: { ingredientId: string | null; subRecipeId: string | null; quantity: number; wastePct: number; note: string | null }[];
  };
  options: { ingredients: SourceOption[]; preps: (SourceOption & { approved: boolean })[] };
  menuPriceAed: number | null;
  canApprove: boolean;
  /** Editing the approved version: saving starts a new draft. */
  startsNewVersion: boolean;
}) {
  const { t, locale, money, number } = useAdminI18n();
  const router = useRouter();
  const { busy, run } = useBusy();
  const nextKey = React.useRef(initial.lines.length + 1);
  const [rows, setRows] = React.useState<Row[]>(() =>
    initial.lines.map((l, i) => ({
      key: i + 1,
      source: l.ingredientId ? `i:${l.ingredientId}` : `p:${l.subRecipeId}`,
      quantity: String(l.quantity),
      wastePct: l.wastePct ? String(l.wastePct) : "",
      note: l.note,
    })),
  );
  const [yieldQuantity, setYieldQuantity] = React.useState(String(initial.yieldQuantity));
  const [yieldUnit, setYieldUnit] = React.useState<Unit>(initial.yieldUnit);
  const [note, setNote] = React.useState(initial.note ?? "");
  const [dirty, setDirty] = React.useState(false);

  const sourceOf = (source: string): SourceOption | undefined =>
    source.startsWith("i:") ? options.ingredients.find((o) => o.id === source.slice(2)) : options.preps.find((o) => o.id === source.slice(2));
  const label = (o: SourceOption) => (locale === "fa" && o.nameFa ? o.nameFa : o.name);
  const update = (key: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  // Live cost of what is on screen, with the same rules as the server.
  const costs = rows.map((r) => {
    const o = sourceOf(r.source);
    const q = num(r.quantity);
    if (!o || q == null || o.filsPerUnit == null) return null;
    return grossQuantity(q, num(r.wastePct) ?? 0) * o.filsPerUnit;
  });
  const total = costs.reduce<number>((s, c) => s + (c ?? 0), 0);
  const missing = rows.filter((r, i) => r.source && costs[i] == null).length;
  const yieldNum = kind === "DISH" ? 1 : num(yieldQuantity) ?? 0;
  const margin = kind === "DISH" && menuPriceAed != null ? dishMargin(total, menuPriceAed) : null;

  function payload() {
    const lines = rows
      .filter((r) => r.source)
      .map((r) => {
        const q = num(r.quantity);
        if (q == null || q <= 0) throw { error: "Enter an amount for every line" };
        return {
          ingredientId: r.source.startsWith("i:") ? r.source.slice(2) : null,
          subRecipeId: r.source.startsWith("p:") ? r.source.slice(2) : null,
          quantity: q,
          wastePct: num(r.wastePct) ?? 0,
          note: r.note,
        };
      });
    if (kind === "PREP" && !(yieldNum > 0)) throw { error: "Enter how much one batch makes" };
    return { yieldQuantity: kind === "DISH" ? 1 : yieldNum, yieldUnit: kind === "DISH" ? "PCS" : yieldUnit, note: note.trim() || null, lines };
  }

  const save = (approve: boolean) =>
    run(async () => {
      await send(`/api/admin/ops/recipes/${recipeId}/draft`, "PUT", payload());
      if (approve) {
        await send(`/api/admin/ops/recipes/${recipeId}/approve`, "POST");
        toast.success(t("Approved — this is now the kitchen standard"));
      } else {
        toast.success(t("Draft saved"));
      }
      setDirty(false);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      {startsNewVersion && (
        <p className="rounded-[12px] bg-saffron-orange/[0.12] px-4 py-3 text-[13px] text-cinnamon-bark">
          {t("Changes are saved as a new draft. The approved recipe stays the kitchen standard until the draft is approved.")}
        </p>
      )}

      {kind === "PREP" && (
        <Field label={t("One batch makes")} hint={t("Weigh what comes out of the pot, e.g. cooked rice. Cooking loss or gain is the difference.")}>
          <div className="flex gap-2">
            <TextInput
              dir="ltr"
              inputMode="decimal"
              className="w-40"
              value={yieldQuantity}
              onChange={(e) => {
                setYieldQuantity(e.target.value);
                setDirty(true);
              }}
            />
            <Select
              className="w-28"
              value={yieldUnit}
              onChange={(e) => {
                setYieldUnit(e.target.value as Unit);
                setDirty(true);
              }}
            >
              <option value="G">{t("g")}</option>
              <option value="ML">{t("ml")}</option>
              <option value="PCS">{t("pcs")}</option>
            </Select>
          </div>
        </Field>
      )}

      <div className="space-y-3">
        <div className="hidden grid-cols-[1fr_9rem_6rem_6rem_2.5rem] gap-2 px-1 text-[12px] text-dark-grey sm:grid">
          <span>{t("Ingredient or prep")}</span>
          <span>{kind === "DISH" ? t("Per portion") : t("Per batch")}</span>
          <span>{t("Waste %")}</span>
          <span className="text-end">{t("Cost")}</span>
          <span />
        </div>
        {rows.map((r, i) => {
          const o = sourceOf(r.source);
          return (
            <div key={r.key} className="grid grid-cols-2 gap-2 rounded-[12px] border border-black-iron/[0.08] p-3 sm:grid-cols-[1fr_9rem_6rem_6rem_2.5rem] sm:items-center sm:border-0 sm:p-0">
              <Select
                aria-label={t("Ingredient or prep")}
                className="col-span-2 sm:col-span-1"
                value={r.source}
                onChange={(e) => update(r.key, { source: e.target.value })}
              >
                <option value="">{t("Choose…")}</option>
                {options.preps.length > 0 && (
                  <optgroup label={t("Preps")}>
                    {options.preps.map((p) => (
                      <option key={p.id} value={`p:${p.id}`}>
                        {label(p)}
                        {p.approved ? "" : ` (${t("draft")})`}
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
              <div className="flex min-w-0 items-center gap-2">
                <TextInput
                  dir="ltr"
                  inputMode="decimal"
                  aria-label={kind === "DISH" ? t("Per portion") : t("Per batch")}
                  value={r.quantity}
                  onChange={(e) => update(r.key, { quantity: e.target.value })}
                />
                {o && <UnitLabel unit={o.unit} />}
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
                <span className="text-[13px] text-dark-grey sm:hidden">%</span>
              </div>
              <span className={cn("self-center text-[13.5px] tabular-nums sm:text-end", costs[i] == null && r.source ? "text-cinnamon-bark" : "")}>
                {costs[i] != null ? money(Math.round(costs[i]!)) : r.source ? t("no price") : "—"}
              </span>
              <div className="flex justify-end">
                <IconButton
                  label={t("Remove line")}
                  danger
                  onClick={() => {
                    setRows((rs) => rs.filter((x) => x.key !== r.key));
                    setDirty(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setRows((rs) => [...rs, { key: nextKey.current++, source: "", quantity: "", wastePct: "", note: null }]);
            setDirty(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t("Add line")}
        </Button>
      </div>

      <Field label={t("What changed")} hint={t("Optional, e.g. “less oil, agreed with the chef”.")}>
        <TextInput dir="auto" value={note} onChange={(e) => { setNote(e.target.value); setDirty(true); }} />
      </Field>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-black-iron/[0.06] pt-4">
        <div className="text-[13.5px]">
          <p>
            <span className="text-dark-grey">{kind === "DISH" ? t("Cost per portion") : t("Cost per batch")}: </span>
            <span className="font-semibold tabular-nums">{money(Math.round(total))}</span>
            {kind === "PREP" && yieldNum > 0 && (
              <span className="text-dark-grey"> · {t("{amount} costs {cost}", { amount: amountText(yieldUnit === "PCS" ? 1 : 1000, BASE[yieldUnit], locale), cost: money(Math.round((total / yieldNum) * (yieldUnit === "PCS" ? 1 : 1000))) })}</span>
            )}
          </p>
          {margin && margin.foodCostPct != null && (
            <p className="text-dark-grey">
              {t("Food cost {pct}% of {price} (ex VAT)", { pct: number(margin.foodCostPct, { max: 1 }), price: money(margin.priceExVatFils) })}
            </p>
          )}
          {missing > 0 && <p className="text-cinnamon-bark">{t("{n} lines have no price yet — the cost is an estimate.", { n: missing })}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="md" disabled={busy || !dirty} onClick={() => save(false)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t("Save draft")}
          </Button>
          {/* With no draft and no edits there is nothing new to approve. */}
          {canApprove && (dirty || !startsNewVersion) && (
            <Button type="button" size="md" disabled={busy || rows.every((r) => !r.source)} onClick={() => save(true)}>
              <CheckCircle2 className="h-4 w-4" /> {dirty ? t("Save and approve") : t("Approve")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Approved recipe, scaled ────────────────────────────────────────────────

export type SheetLine = {
  key: string;
  name: string;
  href: string | null;
  unit: Unit;
  quantity: number;
  wastePct: number;
  costFils: number | null;
};

const BATCHES = [1, 5, 10, 20, 25];

export function RecipeSheet({ lines, kind, yieldQuantity, yieldUnit }: { lines: SheetLine[]; kind: "DISH" | "PREP"; yieldQuantity: number; yieldUnit: Unit }) {
  const { t, locale, money } = useAdminI18n();
  const [batch, setBatch] = React.useState(1);
  const total = lines.reduce((s, l) => s + (l.costFils ?? 0), 0) * batch;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4 md:px-6">
        <span className="me-1 text-[13px] text-dark-grey">{kind === "DISH" ? t("Portions") : t("Batches")}</span>
        {BATCHES.map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={batch === b}
            onClick={() => setBatch(b)}
            className={cn(
              "h-10 min-w-12 rounded-full border px-3 text-[13px] font-medium tabular-nums transition-colors",
              batch === b ? "border-terracotta bg-terracotta text-white" : "border-black-iron/15 bg-white hover:border-black-iron/30",
            )}
          >
            {b}
          </button>
        ))}
        {kind === "PREP" && (
          <span className="ms-auto text-[13px] text-dark-grey">
            {t("Makes {amount}", { amount: amountText(yieldQuantity * batch, BASE[yieldUnit], locale) })}
          </span>
        )}
      </div>
      <ul className="mt-3 divide-y divide-black-iron/[0.06] text-[14px]">
        {lines.map((l) => (
          <li key={l.key} className="flex items-center gap-3 px-5 py-3 md:px-6">
            <span dir="auto" className="min-w-0 flex-1 truncate">
              {l.href ? (
                <Link href={l.href} className="hover:underline">
                  {l.name}
                </Link>
              ) : (
                l.name
              )}
              {l.wastePct > 0 && <span className="text-dark-grey"> · {t("{pct}% waste", { pct: l.wastePct })}</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{amountText(l.quantity * batch, BASE[l.unit], locale)}</span>
            <span className={cn("w-24 shrink-0 text-end tabular-nums", l.costFils == null ? "text-cinnamon-bark" : "text-dark-grey")}>
              {l.costFils == null ? t("no price") : money(Math.round(l.costFils * batch))}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between border-t border-black-iron/[0.06] px-5 py-3 text-[14px] font-semibold md:px-6">
        <span>{t("Total")}</span>
        <span className="tabular-nums">{money(Math.round(total))}</span>
      </p>
    </div>
  );
}

// ─── Details and removal ────────────────────────────────────────────────────

export function RecipeDetailsForm({ recipe }: { recipe: { id: string; name: string; nameFa: string | null } }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const { busy, run } = useBusy();
  const [name, setName] = React.useState(recipe.name);
  const [nameFa, setNameFa] = React.useState(recipe.nameFa ?? "");
  return (
    <form
      className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await send(`/api/admin/ops/recipes/${recipe.id}`, "PATCH", { name, nameFa });
          toast.success(t("Saved"));
          router.refresh();
        });
      }}
    >
      <Field label={t("Name")} required>
        <TextInput dir="auto" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t("Persian name")}>
        <TextInput lang="fa" dir="rtl" value={nameFa} onChange={(e) => setNameFa(e.target.value)} />
      </Field>
      <Button type="submit" variant="outline" size="md" disabled={busy}>
        {t("Save")}
      </Button>
    </form>
  );
}

export function DiscardDraftButton({ recipeId }: { recipeId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const { busy, run } = useBusy();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={() => {
        if (!window.confirm(t("Throw away this draft? The approved recipe stays as it is."))) return;
        void run(async () => {
          await send(`/api/admin/ops/recipes/${recipeId}/draft`, "DELETE");
          toast.success(t("Draft discarded"));
          router.refresh();
        });
      }}
    >
      {t("Discard draft")}
    </Button>
  );
}

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const { busy, run } = useBusy();
  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={busy}
      onClick={() => {
        if (!window.confirm(t("Delete this recipe?"))) return;
        void run(async () => {
          await send(`/api/admin/ops/recipes/${recipeId}`, "DELETE");
          toast.success(t("Recipe deleted"));
          router.push("/admin/ops/recipes");
        });
      }}
    >
      <Trash2 className="h-4 w-4" /> {t("Delete recipe")}
    </Button>
  );
}
