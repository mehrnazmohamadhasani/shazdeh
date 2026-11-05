"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Check, Gift, Loader2, Minus, Pencil, Plus, Search, Soup, Trash2, Users, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, chipButtonClass, chipDangerClass } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { messageFromUnknown } from "@/lib/error-message";
import { UNIT } from "@/components/admin/ops/format";
import type { BaseUnit } from "@/lib/ops/units";
import { FREE_FOOD_KINDS, FREE_FOOD_LABEL, type FreeFoodKind } from "@/lib/ops/free-food-shared";
import { cn } from "@/lib/utils";

/*
 * Recording free food, phone first: what kind, which dishes (tap to add,
 * + / − for portions) or stock items as they are (found by searching,
 * typed in kg / L / pieces), who got it and why. The cost from the approved
 * recipes is shown before saving; a dish without one says "unknown".
 * The same form edits a saved record (opened with ?edit=<id>).
 */

export type MenuDish = { id: string; name: string; nameFa: string | null; category: string };
export type StockOption = { id: string; name: string; nameFa: string | null; unit: string };
export type EditingFreeFood = {
  id: string;
  kind: FreeFoodKind;
  day: string;
  recipient: string | null;
  reason: string | null;
  items: { menuItemId: string; quantity: number }[];
  stock: { ingredientId: string; amount: number }[];
};
type Priced = {
  lines: { menuItemId: string; quantity: number; unitCostFils: number | null; costGap: string | null; menuPriceFils: number }[];
  stockLines: { ingredientId: string; costFils: number | null }[];
  costFils: number | null;
  menuValueFils: number;
};

const KIND_ICON = { STAFF_MEAL: Users, GIFT: Gift, TASTING: Wine, COMPENSATION: Soup } as const;
const KIND_HINT: Record<FreeFoodKind, string> = {
  STAFF_MEAL: "Food the team ate",
  GIFT: "Given away (photographer, neighbours, workers)",
  TASTING: "Tried to check or show a dish",
  COMPENSATION: "Given to make up for a complaint",
};

/** Typed in kg / L / pieces, stored in g / ml / pieces. */
const PER: Record<BaseUnit, number> = { g: 1000, ml: 1000, pcs: 1 };
const BIG: Record<BaseUnit, string> = { g: "kg", ml: "L", pcs: "pcs" };
const toBase = (typed: string, unit: BaseUnit) => {
  const n = Number(typed.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n * PER[unit] : null;
};

export function FreeFoodForm({
  dishes,
  stockItems,
  today,
  defaultDay,
  editing,
  doneHref,
}: {
  dishes: MenuDish[];
  stockItems: StockOption[];
  today: string;
  /** The day shown below the form: a new record goes on it unless changed. */
  defaultDay?: string;
  editing?: EditingFreeFood | null;
  doneHref: string;
}) {
  const { t, locale, money } = useAdminI18n();
  const router = useRouter();
  const uid = React.useId();
  const [kind, setKind] = React.useState<FreeFoodKind>(editing?.kind ?? "STAFF_MEAL");
  const [lines, setLines] = React.useState<{ id: string; quantity: number }[]>(
    () => editing?.items.filter((i) => dishes.some((d) => d.id === i.menuItemId)).map((i) => ({ id: i.menuItemId, quantity: i.quantity })) ?? [],
  );
  // Stock items with the amount as typed (kg / L / pieces).
  const [stockLines, setStockLines] = React.useState<{ id: string; typed: string }[]>(
    () =>
      editing?.stock.flatMap((s) => {
        const item = stockItems.find((x) => x.id === s.ingredientId);
        return item ? [{ id: s.ingredientId, typed: String(Number((s.amount / PER[UNIT[item.unit]]).toFixed(3))) }] : [];
      }) ?? [],
  );
  const [query, setQuery] = React.useState("");
  const [recipient, setRecipient] = React.useState(editing?.recipient ?? "");
  const [reason, setReason] = React.useState(editing?.reason ?? "");
  const [day, setDay] = React.useState(editing?.day ?? defaultDay ?? today);
  const [priced, setPriced] = React.useState<Priced | null>(null);
  const [saving, setSaving] = React.useState(false);

  const nameOf = (d: { name: string; nameFa: string | null }) => (locale === "fa" && d.nameFa ? d.nameFa : d.name);
  const items = React.useMemo(() => lines.map((l) => ({ menuItemId: l.id, quantity: l.quantity })), [lines]);
  const unitOf = (id: string) => UNIT[stockItems.find((x) => x.id === id)?.unit ?? "PCS"];
  // Only the stock lines with an amount count (and are priced and saved).
  const stock = React.useMemo(
    () =>
      stockLines.flatMap((l) => {
        const amount = toBase(l.typed, UNIT[stockItems.find((x) => x.id === l.id)?.unit ?? "PCS"]);
        return amount ? [{ ingredientId: l.id, amount }] : [];
      }),
    [stockLines, stockItems],
  );
  const empty = items.length === 0 && stock.length === 0;

  // The cost as it stands now, worked out on the server from the approved recipes.
  React.useEffect(() => {
    if (items.length === 0 && stock.length === 0) return;
    let live = true;
    const timer = setTimeout(async () => {
      const res = await fetch("/api/admin/ops/free-food/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, stock }) });
      const body = await res.json().catch(() => null);
      if (live && res.ok) setPriced(body);
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [items, stock]);
  const shown = empty ? null : priced;

  const add = (id: string) =>
    setLines((ls) => (ls.some((l) => l.id === id) ? ls.map((l) => (l.id === id ? { ...l, quantity: Math.min(50, l.quantity + 1) } : l)) : [...ls, { id, quantity: 1 }]));
  const setQty = (id: string, quantity: number) => setLines((ls) => (quantity <= 0 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...l, quantity } : l))));

  const addStock = (id: string) => {
    setStockLines((ls) => (ls.some((l) => l.id === id) ? ls : [...ls, { id, typed: "1" }]));
    setQuery("");
  };
  const setTyped = (id: string, typed: string) => setStockLines((ls) => ls.map((l) => (l.id === id ? { ...l, typed } : l)));
  const dropStock = (id: string) => setStockLines((ls) => ls.filter((l) => l.id !== id));

  const q = query.trim().toLowerCase();
  const found = (x: { name: string; nameFa: string | null }) => x.name.toLowerCase().includes(q) || (x.nameFa ?? "").includes(query.trim());
  const matches = q ? dishes.filter(found) : dishes;
  const categories = [...new Set(matches.map((d) => d.category))];
  // Stock items only when searching: 100 chips would bury the dishes.
  const stockMatches = q ? stockItems.filter(found).slice(0, 12) : [];
  const unfinished = stockLines.length > stock.length;

  async function save() {
    if (empty || saving) return;
    if (unfinished) return toast.error(t("Enter how much of each stock item."));
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/admin/ops/free-food/${editing.id}` : "/api/admin/ops/free-food", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, day: day === today ? null : day, items, stock, recipient: recipient.trim() || null, reason: reason.trim() || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw body;
      toast.success(body.skipped?.length ? t("Saved. Some dishes have no approved recipe, so they took no stock.") : t("Saved. Stock taken out."));
      if (editing) {
        router.push(doneHref);
      } else {
        setLines([]);
        setStockLines([]);
        setRecipient("");
        setReason("");
      }
      router.refresh();
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Couldn't save it.")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("What kind")}>
        {FREE_FOOD_KINDS.map((k) => {
          const Icon = KIND_ICON[k];
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[14px] border px-2 py-2 text-[14px] font-medium transition-colors",
                kind === k ? "border-terracotta bg-terracotta/[0.07] text-terracotta-ink" : "border-black-iron/[0.1] bg-white text-black-iron",
              )}
            >
              <Icon className="h-5 w-5" />
              {t(FREE_FOOD_LABEL[k])}
            </button>
          );
        })}
      </div>
      <p className="-mt-2 text-[12.5px] text-dark-grey">{t(KIND_HINT[kind])}</p>

      {lines.length > 0 && (
        <ul className="divide-y divide-black-iron/[0.06] rounded-[14px] border border-black-iron/[0.08] bg-white">
          {lines.map((l) => {
            const d = dishes.find((x) => x.id === l.id)!;
            const p = shown?.lines.find((x) => x.menuItemId === l.id);
            return (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-black-iron">{nameOf(d)}</span>
                  <span className="block text-[12.5px] text-dark-grey">
                    {p == null
                      ? "…"
                      : p.unitCostFils != null
                        ? t("Cost {amount} each · estimated", { amount: money(p.unitCostFils) })
                        : p.costGap === "no_price"
                          ? t("Cost unknown — an ingredient has no price yet")
                          : t("Cost unknown — no approved recipe")}
                  </span>
                </span>
                <button type="button" aria-label={t("One less")} onClick={() => setQty(l.id, l.quantity - 1)} className="grid h-10 w-10 place-items-center rounded-full border border-black-iron/[0.12]">
                  {l.quantity > 1 ? <Minus className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                </button>
                <span className="w-7 text-center text-[16px] font-semibold tabular-nums">{l.quantity}</span>
                <button type="button" aria-label={t("One more")} onClick={() => setQty(l.id, Math.min(50, l.quantity + 1))} className="grid h-10 w-10 place-items-center rounded-full border border-black-iron/[0.12]">
                  <Plus className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {stockLines.length > 0 && (
        <ul className="divide-y divide-black-iron/[0.06] rounded-[14px] border border-black-iron/[0.08] bg-white">
          {stockLines.map((l) => {
            const item = stockItems.find((x) => x.id === l.id)!;
            const unit = unitOf(l.id);
            const p = shown?.stockLines.find((x) => x.ingredientId === l.id);
            const amount = toBase(l.typed, unit);
            return (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-black-iron">{nameOf(item)}</span>
                  <span className="block text-[12.5px] text-dark-grey">
                    {t("From stock")}
                    {" · "}
                    {amount == null || p == null ? "…" : p.costFils != null ? t("Cost {amount}", { amount: money(p.costFils) }) : t("Cost unknown — no price yet")}
                  </span>
                </span>
                <TextInput
                  dir="ltr"
                  inputMode="decimal"
                  value={l.typed}
                  onChange={(e) => setTyped(l.id, e.target.value)}
                  aria-label={t("Amount ({unit})", { unit: t(BIG[unit]) })}
                  className="w-20 text-center"
                />
                <span className="w-8 text-[13px] text-dark-grey">{t(BIG[unit])}</span>
                <button type="button" aria-label={t("Remove")} onClick={() => dropStock(l.id)} className="grid h-10 w-10 place-items-center rounded-full border border-black-iron/[0.12]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-grey" />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Find a dish or stock item")} className="ps-9" aria-label={t("Find a dish or stock item")} />
        </div>
        <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pe-1">
          {stockMatches.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.12em] text-dark-grey">{t("From stock")}</p>
              <div className="flex flex-wrap gap-1.5">
                {stockMatches.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addStock(s.id)}
                    className="inline-flex h-10 items-center gap-1 rounded-full border border-dashed border-black-iron/[0.2] bg-white px-3.5 text-[13.5px] text-black-iron transition-colors hover:border-terracotta"
                  >
                    <Plus className="h-3.5 w-3.5" /> {nameOf(s)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {categories.map((c) => (
            <div key={c}>
              <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.12em] text-dark-grey">{c}</p>
              <div className="flex flex-wrap gap-1.5">
                {matches
                  .filter((d) => d.category === c)
                  .map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => add(d.id)}
                      className="inline-flex h-10 items-center gap-1 rounded-full border border-black-iron/[0.1] bg-white px-3.5 text-[13.5px] text-black-iron transition-colors hover:border-terracotta"
                    >
                      <Plus className="h-3.5 w-3.5" /> {nameOf(d)}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          {matches.length === 0 && stockMatches.length === 0 && <p className="py-3 text-center text-[13px] text-dark-grey">{t("Nothing matches.")}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field htmlFor={`${uid}-who`} label={kind === "STAFF_MEAL" ? t("Who ate (optional)") : t("Given to (optional)")}>
          <TextInput id={`${uid}-who`} value={recipient} onChange={(e) => setRecipient(e.target.value.slice(0, 80))} placeholder={kind === "STAFF_MEAL" ? t("e.g. lunch, 4 staff") : t("e.g. photographer")} />
        </Field>
        <Field htmlFor={`${uid}-why`} label={t("Why (optional)")}>
          <TextInput id={`${uid}-why`} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} />
        </Field>
        <Field htmlFor={`${uid}-day`} label={t("Day")}>
          <TextInput id={`${uid}-day`} type="date" value={day} max={today} onChange={(e) => setDay(e.target.value || today)} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-black-iron/[0.03] px-4 py-3">
        <div className="min-w-0 flex-1 text-[14px]">
          {shown ? (
            <>
              <p className="font-semibold text-black-iron">
                {shown.costFils != null ? t("Food cost {amount} · estimated", { amount: money(shown.costFils) }) : t("Food cost unknown for some items")}
              </p>
              <p className="text-[12.5px] text-dark-grey">{t("On the menu: {amount}", { amount: money(shown.menuValueFils) })}</p>
            </>
          ) : (
            <p className="text-dark-grey">{t("Add the dishes or stock items that were given.")}</p>
          )}
        </div>
        {editing && (
          <Button asChild size="md" variant="ghost">
            <Link href={doneHref}>{t("Cancel")}</Link>
          </Button>
        )}
        <Button size="md" disabled={empty || saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("Save")}
        </Button>
      </div>
    </div>
  );
}

/** Edit and Delete for one saved record. Delete asks once more in place. */
export function FreeFoodActions({ id, editHref }: { id: string; editHref: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/ops/free-food/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw body;
      toast.success(t("Deleted. Stock put back."));
      router.refresh();
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Couldn't delete it.")));
    } finally {
      setBusy(false);
      setAsking(false);
    }
  }
  return asking ? (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <span className="text-[13px] text-pomegranate-red">{t("Delete this record?")}</span>
      <button type="button" disabled={busy} onClick={remove} className={chipDangerClass}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} {t("Delete")}
      </button>
      <button type="button" onClick={() => setAsking(false)} className={chipButtonClass}>
        {t("Cancel")}
      </button>
    </span>
  ) : (
    <span className="inline-flex items-center gap-2">
      <Link href={editHref} className={chipButtonClass}>
        <Pencil className="h-3.5 w-3.5" /> {t("Edit")}
      </Link>
      <button type="button" onClick={() => setAsking(true)} className={chipDangerClass}>
        <Trash2 className="h-3.5 w-3.5" /> {t("Delete")}
      </button>
    </span>
  );
}
