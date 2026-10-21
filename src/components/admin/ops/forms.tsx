"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardPaste, Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, IconButton, Select, TextArea, TextInput } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { amountText, weekday } from "@/components/admin/ops/format";
import { messageFromUnknown } from "@/lib/error-message";
import type { BaseUnit } from "@/lib/ops/units";
import { parseStockLines } from "@/lib/ops/paste";
import { cn } from "@/lib/utils";

/*
 * Small forms for the purchasing screens: supplier details, merging,
 * ingredient details, manual stock movements, the stock count and the
 * opening stock.
 * Amounts are typed in kg / L / pieces and sent in g / ml / pieces.
 */

const PER: Record<BaseUnit, number> = { g: 1000, ml: 1000, pcs: 1 };
const DISPLAY: Record<BaseUnit, string> = { g: "kg", ml: "L", pcs: "pcs" };
const today = () => new Date().toISOString().slice(0, 10);

function num(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function useSubmit() {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function submit(url: string, method: "POST" | "PATCH", body: unknown, success: string, then?: (json: Record<string, unknown>) => void) {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw json;
      toast.success(success);
      if (then) then(json);
      else router.refresh();
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Could not save")));
    } finally {
      setBusy(false);
    }
  }
  return { busy, submit, router };
}

// ─── Supplier ───────────────────────────────────────────────────────────────

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function SupplierForm({
  supplier,
}: {
  supplier: {
    id: string;
    name: string;
    trn: string | null;
    phone: string | null;
    notes: string | null;
    deliveryDays: number[];
    leadTimeDays: number | null;
    paymentTermsDays: number | null;
  };
}) {
  const { t, locale } = useAdminI18n();
  const { busy, submit } = useSubmit();
  const [d, setD] = React.useState({
    name: supplier.name,
    trn: supplier.trn ?? "",
    phone: supplier.phone ?? "",
    notes: supplier.notes ?? "",
    deliveryDays: supplier.deliveryDays,
    leadTimeDays: supplier.leadTimeDays == null ? "" : String(supplier.leadTimeDays),
    paymentTermsDays: supplier.paymentTermsDays == null ? "" : String(supplier.paymentTermsDays),
  });
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(`/api/admin/ops/suppliers/${supplier.id}`, "PATCH", {
          name: d.name,
          trn: d.trn,
          phone: d.phone,
          notes: d.notes,
          deliveryDays: d.deliveryDays,
          leadTimeDays: num(d.leadTimeDays),
          paymentTermsDays: num(d.paymentTermsDays),
        }, t("Supplier saved"));
      }}
    >
      <Field label={t("Name")} required>
        <TextInput dir="auto" required value={d.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label={t("TRN")}>
        <TextInput dir="ltr" inputMode="numeric" value={d.trn} onChange={(e) => set({ trn: e.target.value })} placeholder={t("15 digits")} />
      </Field>
      <Field label={t("Phone")}>
        <TextInput dir="ltr" type="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+971…" />
      </Field>
      <Field label={t("Payment terms")} hint={t("Days to pay a credit invoice. Leave empty if they want cash or card.")}>
        <TextInput dir="ltr" inputMode="numeric" value={d.paymentTermsDays} onChange={(e) => set({ paymentTermsDays: e.target.value })} placeholder={t("e.g. {example}", { example: "30" })} />
      </Field>
      <Field label={t("Delivers on")} className="sm:col-span-2">
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((i) => {
            const on = d.deliveryDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                onClick={() => set({ deliveryDays: on ? d.deliveryDays.filter((x) => x !== i) : [...d.deliveryDays, i].sort() })}
                className={cn(
                  "h-11 min-w-14 rounded-full border px-4 text-[13px] font-medium transition-colors",
                  on ? "border-terracotta bg-terracotta text-white" : "border-black-iron/15 bg-white text-black-iron hover:border-black-iron/30",
                )}
              >
                {weekday(i, locale)}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label={t("Lead time")} hint={t("Days from ordering to delivery.")}>
        <TextInput dir="ltr" inputMode="numeric" value={d.leadTimeDays} onChange={(e) => set({ leadTimeDays: e.target.value })} placeholder={t("e.g. {example}", { example: "1" })} />
      </Field>
      <Field label={t("Notes")} className="sm:col-span-2">
        <TextArea dir="auto" rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={t("Contact name, minimum order…")} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Save supplier")}
        </Button>
      </div>
    </form>
  );
}

// ─── Merge (suppliers and ingredients) ──────────────────────────────────────

export function MergeForm({
  url,
  options,
  noun,
  redirectTo,
}: {
  url: string;
  options: { id: string; name: string }[];
  noun: "supplier" | "ingredient";
  /** Where to go afterwards; `{id}` is replaced with the surviving record. */
  redirectTo: string;
}) {
  const { t } = useAdminI18n();
  const { busy, submit, router } = useSubmit();
  const [intoId, setIntoId] = React.useState("");
  if (!options.length) {
    return (
      <p className="text-[13px] text-dark-grey">
        {t(noun === "supplier" ? "No other supplier to merge with." : "No other ingredient to merge with.")}
      </p>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const target = options.find((o) => o.id === intoId);
        if (!target) return;
        const question =
          noun === "supplier"
            ? 'Merge into "{name}"? All history moves there and this supplier is removed.'
            : 'Merge into "{name}"? All history moves there and this ingredient is removed.';
        if (!window.confirm(t(question, { name: target.name }))) return;
        void submit(url, "POST", { intoId }, t("Merged into {name}", { name: target.name }), () => {
          router.push(redirectTo.replace("{id}", intoId));
          router.refresh();
        });
      }}
    >
      <Field label={t(noun === "supplier" ? "Same supplier as…" : "Same ingredient as…")} className="min-w-56 flex-1">
        <Select value={intoId} onChange={(e) => setIntoId(e.target.value)} required>
          <option value="">{t("Choose…")}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id} dir="auto">
              {o.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" size="sm" variant="outline" disabled={busy || !intoId}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("Merge")}
      </Button>
    </form>
  );
}

// ─── Ingredient ─────────────────────────────────────────────────────────────

export function IngredientForm({
  ingredient,
}: {
  ingredient: { id: string; name: string; nameFa: string | null; category: "FOOD" | "PACKAGING" | "SUPPLIES"; unit: BaseUnit; lowStockAt: number | null };
}) {
  const { t } = useAdminI18n();
  const { busy, submit } = useSubmit();
  const [name, setName] = React.useState(ingredient.name);
  const [nameFa, setNameFa] = React.useState(ingredient.nameFa ?? "");
  const [category, setCategory] = React.useState(ingredient.category);
  const per = PER[ingredient.unit];
  const [lowStock, setLowStock] = React.useState(ingredient.lowStockAt == null ? "" : String(ingredient.lowStockAt / per));
  const big = t(ingredient.unit === "g" ? "kg" : ingredient.unit === "ml" ? "litres" : "pieces");
  return (
    <form
      className="grid gap-4 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const level = lowStock.trim() === "" ? null : num(lowStock);
        if (lowStock.trim() !== "" && (level == null || level < 0)) return toast.error(t("Enter an amount"));
        void submit(
          `/api/admin/ops/ingredients/${ingredient.id}`,
          "PATCH",
          { name, nameFa, category, lowStockAt: level == null ? null : level * per },
          t("Ingredient saved"),
        );
      }}
    >
      <Field label={t("Name")} required>
        <TextInput dir="auto" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t("Persian name")}>
        <TextInput dir="rtl" lang="fa" value={nameFa} onChange={(e) => setNameFa(e.target.value)} placeholder="مثلاً برنج" />
      </Field>
      <Field label={t("Type")}>
        <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          <option value="FOOD">{t("Food")}</option>
          <option value="PACKAGING">{t("Packaging")}</option>
                    <option value="SUPPLIES">{t("Supplies")}</option>
        </Select>
      </Field>
      <Field label={t("Warn when stock is at or below ({unit})", { unit: big })} hint={t("Shown on Today. Leave empty for no warning.")}>
        <TextInput inputMode="decimal" value={lowStock} onChange={(e) => setLowStock(e.target.value)} placeholder="—" />
      </Field>
      <div className="sm:col-span-4">
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Save")}
        </Button>
      </div>
    </form>
  );
}

// Correction first (and chosen by default): the most common entry.
const MOVEMENT_LABEL = { ADJUSTMENT: "Correction (+ or −)", WASTE: "Waste (thrown away)", STAFF_MEAL: "Staff meal" } as const;

export function MovementForm({ ingredientId, unit }: { ingredientId: string; unit: BaseUnit }) {
  const { t } = useAdminI18n();
  const { busy, submit, router } = useSubmit();
  const [type, setType] = React.useState<keyof typeof MOVEMENT_LABEL>("ADJUSTMENT");
  const [amount, setAmount] = React.useState("");
  const [day, setDay] = React.useState(today);
  const [note, setNote] = React.useState("");
  const value = num(amount);
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        if (value == null || value === 0) return toast.error(t("Enter an amount"));
        void submit(
          `/api/admin/ops/ingredients/${ingredientId}/movements`,
          "POST",
          { type, quantity: value * PER[unit], day, note },
          t("Stock updated"),
          () => {
            setAmount("");
            setNote("");
            router.refresh();
          },
        );
      }}
    >
      <Field label={t("What happened")}>
        <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          {Object.entries(MOVEMENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("Amount ({unit})", { unit: t(DISPLAY[unit]) })} hint={t(type === "ADJUSTMENT" ? "Use − to remove" : "Taken out of stock")}>
        <TextInput dir="ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("e.g. {example}", { example: type === "ADJUSTMENT" ? "-0.5" : "0.5" })} />
      </Field>
      <Field label={t("Day")}>
        <TextInput type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </Field>
      <Field label={t("Note")} className="sm:col-span-2">
        <TextInput dir="auto" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. burnt rice, expired")} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Save")}
        </Button>
      </div>
    </form>
  );
}

// ─── Stock count ────────────────────────────────────────────────────────────

export function CountForm({ rows }: { rows: { id: string; name: string; unit: BaseUnit; onHand: number }[] }) {
  const { t, locale } = useAdminI18n();
  const { busy, submit, router } = useSubmit();
  const [day, setDay] = React.useState(today);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const entered = rows.filter((r) => num(values[r.id] ?? "") != null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!entered.length) return toast.error(t("Enter at least one count"));
        void submit(
          "/api/admin/ops/stock/count",
          "POST",
          { day, counts: entered.map((r) => ({ ingredientId: r.id, counted: num(values[r.id])! * PER[r.unit] })) },
          t(entered.length > 1 ? "Count saved — {n} items" : "Count saved — {n} item", { n: entered.length }),
          () => {
            router.push("/admin/ops/stock");
            router.refresh();
          },
        );
      }}
    >
      <div className="flex flex-wrap items-end gap-3 px-5 py-4 md:px-6">
        <Field label={t("Count day")}>
          <TextInput type="date" dir="ltr" value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
        </Field>
        <p className="pb-3 text-[13px] text-dark-grey">{t("Only fill in what you counted; empty rows are left as they are.")}</p>
      </div>
      <ul className="divide-y divide-black-iron/[0.06] border-t border-black-iron/[0.06]">
        {rows.map((r) => {
          const v = num(values[r.id] ?? "");
          const diff = v == null ? null : v * PER[r.unit] - r.onHand;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 md:px-6">
              <div className="min-w-0 flex-1">
                <p dir="auto" className="text-[14.5px] font-medium">{r.name}</p>
                <p className="text-[12.5px] text-dark-grey">
                  {t("System says {amount}", { amount: amountText(r.onHand, r.unit, locale) })}
                  {diff != null && Math.abs(diff) > 1e-9 && (
                    <span className={diff < 0 ? "text-pomegranate-red" : "text-olive-leaf"}>
                      {" "}· {diff > 0 ? "+" : "−"}
                      {amountText(Math.abs(diff), r.unit, locale)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TextInput
                  aria-label={t("{name} counted ({unit})", { name: r.name, unit: t(DISPLAY[r.unit]) })}
                  dir="ltr"
                  inputMode="decimal"
                  className="w-28 text-end"
                  value={values[r.id] ?? ""}
                  onChange={(e) => setValues((x) => ({ ...x, [r.id]: e.target.value }))}
                />
                <span className="w-8 text-[13px] text-dark-grey">{t(DISPLAY[r.unit])}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-0 border-t border-black-iron/[0.07] bg-white/95 px-5 py-3 backdrop-blur md:px-6">
        <Button type="submit" disabled={busy || !entered.length}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Save count ({n})", { n: entered.length })}
        </Button>
      </div>
    </form>
  );
}

// ─── Opening stock ──────────────────────────────────────────────────────────

type OpeningRow = {
  key: string;
  name: string;
  unit: BaseUnit;
  category: "FOOD" | "PACKAGING" | "SUPPLIES";
  /** In kg / L / pcs. */
  qty: string;
  /** AED per kg / L / pc, ex VAT. */
  price: string;
};

let rowSeq = 0;
const blankRow = (): OpeningRow => ({ key: `r${++rowSeq}`, name: "", unit: "g", category: "FOOD", qty: "", price: "" });

/** First day of the current month in Dubai, YYYY-MM-DD. */
function firstOfMonth() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
  return `${today.slice(0, 7)}-01`;
}

/** Pasted Excel rows → form rows (amounts in kg / L / pcs). */
function parsePasted(text: string): OpeningRow[] {
  return parseStockLines(text).map((l) => ({
    ...blankRow(),
    name: l.name,
    unit: l.unit,
    qty: l.quantity == null ? "" : String(l.quantity),
    price: l.price == null ? "" : String(l.price),
  }));
}

export function OpeningStockForm({
  ingredients,
}: {
  ingredients: { id: string; name: string; unit: BaseUnit; category: "FOOD" | "PACKAGING" | "SUPPLIES"; hasOpening: boolean }[];
}) {
  const { t, money } = useAdminI18n();
  const { busy, submit, router } = useSubmit();
  const [day, setDay] = React.useState(firstOfMonth);
  const [rows, setRows] = React.useState<OpeningRow[]>(() => [blankRow(), blankRow(), blankRow()]);
  const [pasting, setPasting] = React.useState(false);
  const [pasted, setPasted] = React.useState("");

  const known = (name: string) => ingredients.find((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;
  const update = (key: string, patch: Partial<OpeningRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.name.trim() && (num(r.qty) ?? 0) > 0);
  const valueOf = (r: OpeningRow) => {
    const q = num(r.qty);
    const p = num(r.price);
    return q != null && p != null ? q * p : null;
  };
  const total = filled.reduce((s, r) => s + (valueOf(r) ?? 0), 0);
  const blocked = filled.filter((r) => known(r.name)?.hasOpening);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!filled.length) return toast.error(t("Add at least one item with an amount"));
        if (blocked.length) return toast.error(t("{name} already has an opening stock", { name: blocked[0].name }));
        void submit(
          "/api/admin/ops/stock/opening",
          "POST",
          {
            day,
            rows: filled.map((r) => {
              const k = known(r.name);
              const unit = k?.unit ?? r.unit;
              const value = valueOf(r);
              return {
                ingredientId: k?.id ?? null,
                name: k?.name ?? r.name.trim(),
                unit,
                category: k?.category ?? r.category,
                quantity: num(r.qty)! * PER[unit],
                value: value == null ? null : Math.round(value * 100) / 100,
              };
            }),
          },
          t("Opening stock saved — {n} items", { n: filled.length }),
          () => {
            router.push("/admin/ops/stock");
            router.refresh();
          },
        );
      }}
    >
      <div className="flex flex-wrap items-end gap-3 px-5 py-4 md:px-6">
        <Field label={t("Stock on the morning of")}>
          <TextInput type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
        </Field>
        <Button type="button" variant="outline" size="sm" onClick={() => setPasting((v) => !v)}>
          <ClipboardPaste className="h-4 w-4" /> {t("Paste from Excel")}
        </Button>
      </div>

      {pasting && (
        <div className="space-y-2 border-t border-black-iron/[0.06] px-5 py-4 md:px-6">
          <Field
            label={t("One item per line: name, quantity, unit, price per unit")}
            hint={t("Copy the columns from Excel, or type e.g. “Sella rice, 200, kg, 5.25”. Units: kg, g, L, ml, pcs.")}
          >
            <TextArea rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)} dir="auto" />
          </Field>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const add = parsePasted(pasted);
              if (!add.length) return toast.error(t("Nothing to add — check the lines"));
              setRows((rs) => [...rs.filter((r) => r.name.trim()), ...add]);
              setPasted("");
              setPasting(false);
              toast.success(t("{n} lines added — check them below", { n: add.length }));
            }}
          >
            {t("Add these lines")}
          </Button>
        </div>
      )}

      <ul className="divide-y divide-black-iron/[0.06] border-t border-black-iron/[0.06]">
        {rows.map((r, i) => {
          const k = r.name.trim() ? known(r.name) : null;
          const unit = k?.unit ?? r.unit;
          const value = valueOf(r);
          return (
            <li key={r.key} className="space-y-2 px-5 py-3 md:px-6">
              <div className="flex items-start gap-2">
                <TextInput
                  aria-label={t("Item {n}", { n: i + 1 })}
                  list="opening-ingredients"
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  placeholder={t("e.g. {example}", { example: t("Sella rice") })}
                  className="font-medium"
                  dir="auto"
                />
                <IconButton label={t("Remove item {n}", { n: i + 1 })} danger onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
                <Field label={t("Amount")}>
                  <TextInput inputMode="decimal" value={r.qty} onChange={(e) => update(r.key, { qty: e.target.value })} />
                </Field>
                <Field label={t("Unit")}>
                  <Select value={unit} disabled={!!k} onChange={(e) => update(r.key, { unit: e.target.value as BaseUnit })} className="w-24">
                    {(["g", "ml", "pcs"] as const).map((u) => (
                      <option key={u} value={u}>
                        {t(DISPLAY[u])}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("Price per {unit} (ex VAT)", { unit: t(DISPLAY[unit]) })}>
                  <TextInput inputMode="decimal" value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} placeholder={t("Optional")} />
                </Field>
                <Field label={t("Type")}>
                  <Select
                    value={k?.category ?? r.category}
                    disabled={!!k}
                    onChange={(e) => update(r.key, { category: e.target.value as OpeningRow["category"] })}
                    className="w-36"
                  >
                    <option value="FOOD">{t("Food")}</option>
                    <option value="PACKAGING">{t("Packaging")}</option>
                    <option value="SUPPLIES">{t("Supplies")}</option>
                  </Select>
                </Field>
              </div>
              <p className="text-[12.5px] text-dark-grey">
                {k ? (k.hasOpening ? <span className="text-pomegranate-red">{t("Already has an opening stock — use a stock count instead")}</span> : t("Existing ingredient")) : r.name.trim() ? t("New ingredient") : null}
                {value != null && <span className="tabular-nums"> · {money(Math.round(value * 100))}</span>}
              </p>
            </li>
          );
        })}
      </ul>
      <datalist id="opening-ingredients">
        {ingredients.map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>

      <div className="border-t border-black-iron/[0.06] px-5 py-3 md:px-6">
        <Button type="button" variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>
          <Plus className="h-4 w-4" /> {t("Add item")}
        </Button>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-black-iron/[0.07] bg-white/95 px-5 py-3 backdrop-blur md:px-6">
        <Button type="submit" disabled={busy || !filled.length}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Save opening stock ({n})", { n: filled.length })}
        </Button>
        {total > 0 && <span className="text-[13.5px] tabular-nums text-dark-grey">{t("Value {amount}", { amount: money(Math.round(total * 100)) })}</span>}
      </div>
    </form>
  );
}

// ─── Deleting unused ingredients ────────────────────────────────────────────

type Kept = { code: "recipes"; names: string[] } | { code: "invoice" } | { code: "sales" } | { code: "owner" } | { code: "history" };

/** Why an ingredient has to stay, in the panel's language. */
export function useKeptText() {
  const { t } = useAdminI18n();
  return (kept: Kept) =>
    kept.code === "recipes"
      ? t("It is used in {names}. Remove it from those recipes first.", { names: kept.names.join(", ") })
      : kept.code === "invoice"
        ? t("It is on an invoice that still counts. Undo that invoice first, or merge this ingredient into another.")
        : kept.code === "sales"
          ? t("Sales or free food took stock from it, so it is kept for their history. Merge it into another ingredient instead.")
          : kept.code === "owner"
            ? t("Only the owner can delete it: it has waste or correction entries (they add up to zero).")
            : t("It has stock history (opening stock, counts, waste or sales). Merge it into another ingredient instead.");
}

async function remove(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json as Record<string, unknown>;
}

/**
 * On an ingredient's page, or as an icon in a Stock row (`compact`, stays on
 * the list after). Disabled with the reason while something still uses it.
 */
export function DeleteIngredientButton({ id, name, kept, compact = false }: { id: string; name: string; kept: Kept | null; compact?: boolean }) {
  const { t } = useAdminI18n();
  const keptText = useKeptText();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function run() {
    if (!window.confirm(t("Delete {name}? This can't be undone.", { name }))) return;
    setBusy(true);
    try {
      await remove(`/api/admin/ops/ingredients/${id}`);
      toast.success(t("Ingredient deleted"));
      if (!compact) router.push("/admin/ops/stock?show=all");
      router.refresh();
    } catch (e) {
      const body = (e ?? {}) as { kept?: Kept };
      toast.error(body.kept ? keptText(body.kept) : t(messageFromUnknown(e, "Could not delete")), { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }
  if (compact) {
    // Still tappable while kept: it says why instead of doing nothing.
    return (
      <IconButton
        label={kept ? `${t("Delete ingredient")}: ${keptText(kept)}` : t("Delete {name}", { name })}
        danger
        disabled={busy}
        onClick={() => (kept ? toast.message(keptText(kept), { duration: 8000 }) : void run())}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className={cn("h-4 w-4", kept && "opacity-40")} />}
      </IconButton>
    );
  }
  return (
    <div className="space-y-2">
      <Button variant="destructive" size="sm" disabled={busy || !!kept} onClick={() => void run()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {t("Delete ingredient")}
      </Button>
      <p className="text-[12.5px] text-dark-grey">{kept ? keptText(kept) : t("Nothing uses it any more, so it can be deleted.")}</p>
    </div>
  );
}

// ─── New ingredient / supplier ──────────────────────────────────────────────

/** "New ingredient" on the Stock screen: name and unit, then its page for the rest. */
export function NewIngredientButton() {
  const { t } = useAdminI18n();
  const { busy, submit, router } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [nameFa, setNameFa] = React.useState("");
  const [unit, setUnit] = React.useState<"G" | "ML" | "PCS">("G");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="md" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {t("New ingredient")}
      </Button>
      <DialogContent className="bg-white text-black-iron sm:max-w-lg">
        <form
          className="space-y-5 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit("/api/admin/ops/ingredients", "POST", { name, nameFa, unit }, t("Ingredient added"), (json) => {
              setOpen(false);
              router.push(`/admin/ops/ingredients/${json.id}`);
            });
          }}
        >
          <DialogTitle className="text-[22px] font-bold text-black-iron">{t("New ingredient")}</DialogTitle>
          <DialogDescription className="text-[13.5px] text-dark-grey">
            {t("Invoices add ingredients automatically. Add one here to use it before it is ever bought.")}
          </DialogDescription>
          <Field label={t("Name")} required>
            <TextInput dir="auto" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. {example}", { example: "Basmati rice" })} />
          </Field>
          <Field label={t("Persian name")}>
            <TextInput dir="rtl" lang="fa" value={nameFa} onChange={(e) => setNameFa(e.target.value)} placeholder="مثلاً برنج" />
          </Field>
          <Field label={t("Counted in")} hint={t("This can't be changed later.")}>
            <Select value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}>
              <option value="G">{t("kg")}</option>
              <option value="ML">{t("litres")}</option>
              <option value="PCS">{t("pieces")}</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("Add ingredient")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "New supplier" on the Suppliers screen: name and phone, then its page for the rest. */
export function NewSupplierButton() {
  const { t } = useAdminI18n();
  const { busy, submit, router } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [trn, setTrn] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="md" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {t("New supplier")}
      </Button>
      <DialogContent className="bg-white text-black-iron sm:max-w-lg">
        <form
          className="space-y-5 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(
              "/api/admin/ops/suppliers",
              "POST",
              { name, phone, trn, notes: null, deliveryDays: [], leadTimeDays: null, paymentTermsDays: null },
              t("Supplier added"),
              (json) => {
                setOpen(false);
                router.push(`/admin/ops/suppliers/${json.id}`);
              },
            );
          }}
        >
          <DialogTitle className="text-[22px] font-bold text-black-iron">{t("New supplier")}</DialogTitle>
          <DialogDescription className="text-[13.5px] text-dark-grey">
            {t("Invoices add suppliers automatically. Set delivery days and payment terms on the next screen.")}
          </DialogDescription>
          <Field label={t("Name")} required>
            <TextInput dir="auto" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("Phone")}>
            <TextInput dir="ltr" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971…" />
          </Field>
          <Field label={t("TRN")}>
            <TextInput dir="ltr" inputMode="numeric" value={trn} onChange={(e) => setTrn(e.target.value)} placeholder={t("15 digits")} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("Add supplier")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Delete a supplier with no invoices: a full button on its page, an icon in a list row (`compact`). */
export function DeleteSupplierButton({ id, name, invoiceCount, compact = false }: { id: string; name: string; invoiceCount: number; compact?: boolean }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const keptText = t("It has invoices, so it is kept for their history. Merge it into another supplier instead.");
  const kept = invoiceCount > 0;
  async function run() {
    if (!window.confirm(t("Delete {name}? This can't be undone.", { name }))) return;
    setBusy(true);
    try {
      await remove(`/api/admin/ops/suppliers/${id}`);
      toast.success(t("Supplier deleted"));
      if (!compact) router.push("/admin/ops/suppliers");
      router.refresh();
    } catch (e) {
      const body = (e ?? {}) as { kept?: unknown };
      toast.error(body.kept ? keptText : t(messageFromUnknown(e, "Could not delete")), { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }
  if (compact) {
    return (
      <IconButton
        label={kept ? `${t("Delete supplier")}: ${keptText}` : t("Delete {name}", { name })}
        danger
        disabled={busy}
        onClick={() => (kept ? toast.message(keptText, { duration: 8000 }) : void run())}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className={cn("h-4 w-4", kept && "opacity-40")} />}
      </IconButton>
    );
  }
  return (
    <div className="space-y-2">
      <Button variant="destructive" size="sm" disabled={busy || kept} onClick={() => void run()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {t("Delete supplier")}
      </Button>
      <p className="text-[12.5px] text-dark-grey">{kept ? keptText : t("It has no invoices, so it can be deleted.")}</p>
    </div>
  );
}

/** On the Stock screen: removes every ingredient nothing uses, e.g. left over from undone invoices. */
export function DeleteUnusedIngredientsButton({ names }: { names: string[] }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(t("Delete {n} ingredients nothing uses any more? {names}. This can't be undone.", { n: names.length, names: names.join(", ") }))) return;
        setBusy(true);
        try {
          const json = await remove("/api/admin/ops/ingredients/unused");
          const skipped = (json.skipped as string[] | undefined) ?? [];
          toast.success(t("{n} ingredients deleted", { n: (json.deleted as string[]).length }));
          if (skipped.length) toast.message(t("Kept because they are in use now: {names}", { names: skipped.join(", ") }));
          router.refresh();
        } catch (e) {
          toast.error(t(messageFromUnknown(e, "Could not delete")));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {t("Delete unused ({n})", { n: names.length })}
    </Button>
  );
}
