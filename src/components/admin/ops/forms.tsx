"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/admin/ui";
import { messageFromUnknown } from "@/lib/error-message";
import { formatAmount, type BaseUnit } from "@/lib/ops/units";
import { cn } from "@/lib/utils";

/*
 * Small forms for the purchasing screens: supplier details, merging,
 * ingredient details, manual stock movements and the stock count.
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
      toast.error(messageFromUnknown(e, "Could not save"));
    } finally {
      setBusy(false);
    }
  }
  return { busy, submit, router };
}

// ─── Supplier ───────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
        }, "Supplier saved");
      }}
    >
      <Field label="Name" required>
        <TextInput required value={d.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="TRN">
        <TextInput inputMode="numeric" value={d.trn} onChange={(e) => set({ trn: e.target.value })} placeholder="15 digits" />
      </Field>
      <Field label="Phone">
        <TextInput type="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+971…" />
      </Field>
      <Field label="Payment terms" hint="Days to pay a credit invoice. Leave empty if they want cash or card.">
        <TextInput inputMode="numeric" value={d.paymentTermsDays} onChange={(e) => set({ paymentTermsDays: e.target.value })} placeholder="e.g. 30" />
      </Field>
      <Field label="Delivers on" className="sm:col-span-2">
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((w, i) => {
            const on = d.deliveryDays.includes(i);
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                onClick={() => set({ deliveryDays: on ? d.deliveryDays.filter((x) => x !== i) : [...d.deliveryDays, i].sort() })}
                className={cn(
                  "h-11 min-w-14 rounded-full border px-4 text-[13px] font-medium transition-colors",
                  on ? "border-terracotta bg-terracotta text-white" : "border-black-iron/15 bg-white text-black-iron hover:border-black-iron/30",
                )}
              >
                {w}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Lead time" hint="Days from ordering to delivery.">
        <TextInput inputMode="numeric" value={d.leadTimeDays} onChange={(e) => set({ leadTimeDays: e.target.value })} placeholder="e.g. 1" />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <TextArea rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Contact name, minimum order…" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save supplier
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
  const { busy, submit, router } = useSubmit();
  const [intoId, setIntoId] = React.useState("");
  if (!options.length) return <p className="text-[13px] text-dark-grey">No other {noun} to merge with.</p>;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const target = options.find((o) => o.id === intoId);
        if (!target || !window.confirm(`Merge into "${target.name}"? All history moves there and this ${noun} is removed.`)) return;
        void submit(url, "POST", { intoId }, `Merged into ${target.name}`, () => {
          router.push(redirectTo.replace("{id}", intoId));
          router.refresh();
        });
      }}
    >
      <Field label={`Same ${noun} as…`} className="min-w-56 flex-1">
        <Select value={intoId} onChange={(e) => setIntoId(e.target.value)} required>
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" size="sm" variant="outline" disabled={busy || !intoId}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Merge
      </Button>
    </form>
  );
}

// ─── Ingredient ─────────────────────────────────────────────────────────────

export function IngredientForm({
  ingredient,
}: {
  ingredient: { id: string; name: string; nameFa: string | null; category: "FOOD" | "PACKAGING" };
}) {
  const { busy, submit } = useSubmit();
  const [name, setName] = React.useState(ingredient.name);
  const [nameFa, setNameFa] = React.useState(ingredient.nameFa ?? "");
  const [category, setCategory] = React.useState(ingredient.category);
  return (
    <form
      className="grid gap-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(`/api/admin/ops/ingredients/${ingredient.id}`, "PATCH", { name, nameFa, category }, "Ingredient saved");
      }}
    >
      <Field label="Name" required>
        <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Persian name">
        <TextInput dir="rtl" lang="fa" value={nameFa} onChange={(e) => setNameFa(e.target.value)} placeholder="مثلاً برنج" />
      </Field>
      <Field label="Type">
        <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          <option value="FOOD">Food</option>
          <option value="PACKAGING">Packaging</option>
        </Select>
      </Field>
      <div className="sm:col-span-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}

const MOVEMENT_LABEL = { WASTE: "Waste (thrown away)", STAFF_MEAL: "Staff meal", ADJUSTMENT: "Correction (+ or −)" } as const;

export function MovementForm({ ingredientId, unit }: { ingredientId: string; unit: BaseUnit }) {
  const { busy, submit, router } = useSubmit();
  const [type, setType] = React.useState<keyof typeof MOVEMENT_LABEL>("WASTE");
  const [amount, setAmount] = React.useState("");
  const [day, setDay] = React.useState(today);
  const [note, setNote] = React.useState("");
  const value = num(amount);
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        if (value == null || value === 0) return toast.error("Enter an amount");
        void submit(
          `/api/admin/ops/ingredients/${ingredientId}/movements`,
          "POST",
          { type, quantity: value * PER[unit], day, note },
          "Stock updated",
          () => {
            setAmount("");
            setNote("");
            router.refresh();
          },
        );
      }}
    >
      <Field label="What happened">
        <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          {Object.entries(MOVEMENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={`Amount (${DISPLAY[unit]})`} hint={type === "ADJUSTMENT" ? "Use − to remove" : "Taken out of stock"}>
        <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={type === "ADJUSTMENT" ? "e.g. -0.5" : "e.g. 0.5"} />
      </Field>
      <Field label="Day">
        <TextInput type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </Field>
      <Field label="Note" className="sm:col-span-2">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. burnt rice, expired" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}

// ─── Stock count ────────────────────────────────────────────────────────────

export function CountForm({ rows }: { rows: { id: string; name: string; unit: BaseUnit; onHand: number }[] }) {
  const { busy, submit, router } = useSubmit();
  const [day, setDay] = React.useState(today);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const entered = rows.filter((r) => num(values[r.id] ?? "") != null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!entered.length) return toast.error("Enter at least one count");
        void submit(
          "/api/admin/ops/stock/count",
          "POST",
          { day, counts: entered.map((r) => ({ ingredientId: r.id, counted: num(values[r.id])! * PER[r.unit] })) },
          `Count saved — ${entered.length} item${entered.length > 1 ? "s" : ""}`,
          () => {
            router.push("/admin/ops/stock");
            router.refresh();
          },
        );
      }}
    >
      <div className="flex flex-wrap items-end gap-3 px-5 py-4 md:px-6">
        <Field label="Count day">
          <TextInput type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
        </Field>
        <p className="pb-3 text-[13px] text-dark-grey">Only fill in what you counted; empty rows are left as they are.</p>
      </div>
      <ul className="divide-y divide-black-iron/[0.06] border-t border-black-iron/[0.06]">
        {rows.map((r) => {
          const v = num(values[r.id] ?? "");
          const diff = v == null ? null : v * PER[r.unit] - r.onHand;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 md:px-6">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium">{r.name}</p>
                <p className="text-[12.5px] text-dark-grey">
                  System says {formatAmount(r.onHand, r.unit)}
                  {diff != null && Math.abs(diff) > 1e-9 && (
                    <span className={diff < 0 ? "text-pomegranate-red" : "text-olive-leaf"}>
                      {" "}· {diff > 0 ? "+" : "−"}
                      {formatAmount(Math.abs(diff), r.unit)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TextInput
                  aria-label={`${r.name} counted (${DISPLAY[r.unit]})`}
                  inputMode="decimal"
                  className="w-28 text-right"
                  value={values[r.id] ?? ""}
                  onChange={(e) => setValues((x) => ({ ...x, [r.id]: e.target.value }))}
                />
                <span className="w-8 text-[13px] text-dark-grey">{DISPLAY[r.unit]}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-0 border-t border-black-iron/[0.07] bg-white/95 px-5 py-3 backdrop-blur md:px-6">
        <Button type="submit" disabled={busy || !entered.length}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save count ({entered.length})
        </Button>
      </div>
    </form>
  );
}
