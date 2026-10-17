"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Info, Loader2, Plus, RotateCw, Sparkles, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Field, IconButton, Select, StatusPill, TextArea, TextInput, controlClass } from "@/components/admin/ui";
import { messageFromUnknown } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { checkExtraction, type Flag } from "@/lib/ops/checks";
import { SPEND_CATEGORIES, isStockCategory, type Extraction } from "@/lib/ops/extraction";
import type { Suggestions } from "@/lib/ops/match";
import type { SaveInvoiceInput } from "@/lib/ops/save-schema";
import type { BaseUnit } from "@/lib/ops/units";
import type { Translate } from "@/lib/admin-i18n";
import { useAdminI18n } from "@/components/admin/i18n";
import { amountText } from "@/components/admin/ops/format";

/*
 * Review screen for one AI reading. Everything is pre-filled and
 * editable; the arithmetic checks re-run on every keystroke, so fixing
 * a number clears its warning. Stock is entered in kg / L / pieces and
 * stored in g / ml / pieces.
 */

type Category = (typeof SPEND_CATEGORIES)[number];
type Known = { id: string; name: string };
type KnownSupplier = Known & { trn: string | null; phone: string | null; paymentTermsDays: number | null };
type KnownIngredient = Known & { unit: BaseUnit };

type LineState = {
  key: string;
  rawName: string;
  itemCode: string | null;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
  /** Carried from the reading; not edited on screen. */
  discount: number;
  vat: number | null;
  category: Category;
  ingredientName: string;
  stockUnit: BaseUnit;
  /** In kg / L / pcs. */
  stock: string;
  source: Suggestions["lines"][number]["source"];
  confidence: number;
  note: string | null;
};

const CATEGORY_LABEL: Record<Category, string> = {
  food: "Food",
  packaging: "Packaging",
  supplies: "Supplies (gas, cleaning, disposables)",
  smallwares: "Kitchen equipment",
  delivery: "Delivery charge",
  other: "Other",
};
const DISPLAY_UNIT: Record<BaseUnit, string> = { g: "kg", ml: "L", pcs: "pcs" };
const PER_DISPLAY: Record<BaseUnit, number> = { g: 1000, ml: 1000, pcs: 1 };
const SOURCE_LABEL = { learned: "Remembered", parsed: "From pack size", ai: "AI estimate" } as const;

const text = (v: number | null | undefined) => (v == null ? "" : String(v));
function num(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
const isStock = (c: Category) => isStockCategory(c);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function InvoiceReview({
  documentId,
  reading,
  suggestions,
  suppliers,
  ingredients,
  manual = false,
}: {
  documentId: string;
  reading: Extraction;
  suggestions: Suggestions;
  suppliers: KnownSupplier[];
  ingredients: KnownIngredient[];
  /** Typed in by hand: there is no photo to read again. */
  manual?: boolean;
}) {
  const { t, locale } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState<null | "save" | "read" | "discard">(null);
  const [supplierName, setSupplierName] = React.useState(suggestions.supplierName ?? reading.supplier.name ?? "");
  const [trn, setTrn] = React.useState(reading.supplier.trn ?? "");
  const [phone, setPhone] = React.useState(reading.supplier.phone ?? "");
  const [invoiceNo, setInvoiceNo] = React.useState(reading.invoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = React.useState(reading.invoiceDate ?? "");
  const [paymentMode, setPaymentMode] = React.useState(reading.paymentMode ?? "");
  const [dueDate, setDueDate] = React.useState("");
  const [paidBy, setPaidBy] = React.useState("");
  const [notes, setNotes] = React.useState(reading.notes ?? "");
  const [pricesIncludeVat, setPricesIncludeVat] = React.useState(reading.pricesIncludeVat ?? false);
  const [subtotal, setSubtotal] = React.useState(text(reading.subtotal));
  const [discount, setDiscount] = React.useState(text(reading.discount));
  const [vat, setVat] = React.useState(text(reading.vat));
  const [total, setTotal] = React.useState(text(reading.total));
  const [lines, setLines] = React.useState<LineState[]>(() =>
    reading.lines.map((l, i) => {
      const s = suggestions.lines[i];
      const unit = s?.unit ?? l.stockUnit ?? "g";
      return {
        key: `l${i}`,
        rawName: l.description,
        itemCode: l.itemCode,
        quantity: text(l.quantity),
        unit: l.unit ?? "",
        unitPrice: text(l.unitPrice),
        lineTotal: text(l.lineTotal),
        discount: l.discount ?? 0,
        vat: l.vat,
        category: l.category,
        ingredientName: s?.ingredientName ?? (isStock(l.category) ? l.description : ""),
        stockUnit: unit,
        stock: s?.quantity != null ? String(Number((s.quantity / PER_DISPLAY[unit]).toFixed(3))) : "",
        source: s?.source ?? null,
        confidence: l.confidence,
        note: l.note,
      };
    }),
  );

  const supplier = suppliers.find((s) => same(s.name, supplierName)) ?? null;
  // Credit: suggest the due date from the supplier's terms until someone types one.
  const suggestedDue =
    paymentMode === "credit" && supplier?.paymentTermsDays != null && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)
      ? new Date(Date.parse(invoiceDate) + supplier.paymentTermsDays * 86_400_000).toISOString().slice(0, 10)
      : "";
  const ingredientFor = (name: string) => ingredients.find((i) => same(i.name, name)) ?? null;

  // Live checks on what is on screen now.
  const flags = React.useMemo(
    () =>
      checkExtraction({
        ...reading,
        supplier: { name: supplierName || null, trn: trn || null, phone: phone || null },
        invoiceDate: invoiceDate || null,
        subtotal: num(subtotal),
        discount: num(discount),
        vat: num(vat),
        total: num(total),
        lines: lines.map((l) => ({
          description: l.rawName,
          itemCode: l.itemCode,
          quantity: num(l.quantity),
          unit: l.unit || null,
          packSize: null,
          unitPrice: num(l.unitPrice),
          discount: l.discount,
          vat: l.vat,
          lineTotal: num(l.lineTotal),
          category: l.category,
          stockUnit: null,
          stockQuantity: null,
          confidence: l.confidence,
          note: l.note,
        })),
      }),
    [reading, supplierName, trn, phone, invoiceDate, subtotal, discount, vat, total, lines],
  );
  const docFlags = flags.filter((f) => !f.field.startsWith("line:"));
  const lineFlags = (i: number) => flags.filter((f) => f.field === `line:${i}`);
  const errors = flags.filter((f) => f.level === "error").length;

  function update(key: string, patch: Partial<LineState>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function post(path: string, body?: unknown) {
    const res = await fetch(`/api/admin/ops/documents/${documentId}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw json;
    return json;
  }

  async function save() {
    const missing: string[] = [];
    if (!supplierName.trim()) missing.push(t("supplier"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) missing.push(t("date"));
    if (num(total) == null) missing.push(t("total"));
    lines.forEach((l, i) => {
      if (!(num(l.quantity)! > 0) || num(l.lineTotal) == null) missing.push(t("line {n} quantity/total", { n: i + 1 }));
      if (isStock(l.category) && l.ingredientName.trim() && !(num(l.stock)! > 0)) missing.push(t("line {n} stock amount", { n: i + 1 }));
    });
    if (missing.length) return toast.error(t("Please fill in: {list}", { list: missing.join(t(", ")) }));
    if (
      errors &&
      !window.confirm(t(errors > 1 ? "{n} numbers don't add up. Save anyway?" : "{n} number doesn't add up. Save anyway?", { n: errors }))
    )
      return;

    const input: SaveInvoiceInput = {
      supplier: { id: supplier?.id ?? null, name: supplier?.name ?? supplierName.trim(), trn: trn.trim() || null, phone: phone.trim() || null },
      invoiceNo: invoiceNo.trim() || null,
      invoiceDate,
      paymentMode: (paymentMode || null) as SaveInvoiceInput["paymentMode"],
      dueDate: paymentMode === "credit" ? dueDate || suggestedDue || null : null,
      paidBy: paymentMode && paymentMode !== "credit" ? paidBy.trim() || null : null,
      notes: notes.trim() || null,
      pricesIncludeVat,
      subtotal: num(subtotal),
      discount: num(discount) ?? 0,
      vat: num(vat),
      total: num(total)!,
      lines: lines.map((l) => {
        const known = ingredientFor(l.ingredientName);
        const stocked = isStock(l.category) && l.ingredientName.trim();
        const unit = known?.unit ?? l.stockUnit;
        return {
          rawName: l.rawName.trim() || "Item",
          itemCode: l.itemCode,
          quantity: num(l.quantity)!,
          unit: l.unit.trim() || null,
          unitPrice: num(l.unitPrice),
          discount: l.discount,
          vat: l.vat,
          lineTotal: num(l.lineTotal)!,
          category: l.category,
          ingredient: stocked ? { id: known?.id ?? null, name: known?.name ?? l.ingredientName.trim(), unit } : null,
          stockQuantity: stocked ? num(l.stock)! * PER_DISPLAY[unit] : null,
        };
      }),
    };
    setBusy("save");
    try {
      const result = await post("save", input);
      toast.success(
        result.movements
          ? t(result.movements > 1 ? "Saved — {n} items added to stock" : "Saved — {n} item added to stock", { n: result.movements })
          : t("Saved"),
      );
      router.refresh();
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Could not save")));
    } finally {
      setBusy(null);
    }
  }

  async function readAgain() {
    setBusy("read");
    try {
      await post("read");
      router.refresh();
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Could not read again")));
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    if (!window.confirm(t("Discard this document? Nothing will be saved from it."))) return;
    setBusy("discard");
    try {
      await post("discard");
      router.push("/admin/ops/invoices");
      router.refresh();
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Could not discard")));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {docFlags.length > 0 && <Flags flags={docFlags} />}

      <Card title={t("Supplier & invoice")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("Supplier")}
            required
            hint={supplier ? t("Existing supplier") : supplierName.trim() ? t("Will be added as a new supplier") : undefined}
          >
            <TextInput
              list="ops-suppliers"
              dir="auto"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder={t("e.g. Unknown (handwritten veg)")}
            />
            <datalist id="ops-suppliers">
              {suppliers.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </Field>
          <Field label={t("TRN")}>
            <TextInput dir="ltr" value={trn} onChange={(e) => setTrn(e.target.value)} inputMode="numeric" placeholder={t("15 digits")} />
          </Field>
          <Field
            label={t("Phone")}
            hint={supplier?.phone && phone.trim() && phone.trim() !== supplier.phone ? t("Saved: {phone} (kept)", { phone: supplier.phone }) : undefined}
          >
            <TextInput dir="ltr" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={supplier?.phone ?? undefined} />
          </Field>
          <Field label={t("Invoice number")}>
            <TextInput dir="ltr" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </Field>
          <Field label={t("Invoice date")} required>
            <TextInput type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </Field>
          <Field label={t("Paid by")}>
            <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}>
              <option value="">{t("Not shown")}</option>
              <option value="cash">{t("Cash")}</option>
              <option value="card">{t("Card")}</option>
              <option value="credit">{t("Credit (pay later)")}</option>
              <option value="transfer">{t("Bank transfer")}</option>
            </Select>
          </Field>
          {paymentMode === "credit" ? (
            <Field
              label={t("Payment due")}
              hint={
                supplier?.paymentTermsDays != null
                  ? t("{name}: {n} days", { name: supplier.name, n: supplier.paymentTermsDays })
                  : t("Shows in Payables until paid")
              }
            >
              <TextInput type="date" value={dueDate || suggestedDue} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          ) : paymentMode ? (
            <Field label={t("Who paid")}>
              <TextInput
                list="ops-payers"
                dir="auto"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                placeholder={t("Owner, a staff name, company card…")}
              />
              <datalist id="ops-payers">
                <option value="Owner" />
                <option value="Company card" />
                <option value="Petty cash" />
              </datalist>
            </Field>
          ) : null}
          <label className="flex min-h-11 items-center gap-3 self-end text-[14px]">
            <input type="checkbox" className="h-5 w-5 accent-terracotta" checked={pricesIncludeVat} onChange={(e) => setPricesIncludeVat(e.target.checked)} />
            {t("Line prices already include VAT")}
          </label>
          <Field
            label={t("Notes")}
            hint={t("Handwritten words on the paper are read here (e.g. «باقلی» = fava beans).")}
            className="sm:col-span-2"
          >
            <TextArea dir="auto" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card
        title={t("Items ({n})", { n: lines.length })}
        description={t("Food and packaging go into stock. Check the ingredient name and how much came in.")}
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-black-iron/[0.06]">
          {lines.map((l, i) => {
            const known = ingredientFor(l.ingredientName);
            const unit = known?.unit ?? l.stockUnit;
            const stockBase = num(l.stock) != null ? num(l.stock)! * PER_DISPLAY[unit] : null;
            return (
              <li key={l.key} className={cn("space-y-3 px-5 py-4 md:px-6", l.confidence < 0.7 && "bg-saffron-orange/[0.05]")}>
                <div className="flex items-start gap-3">
                  <span className="mt-2.5 w-5 shrink-0 text-[12px] tabular-nums text-dark-grey">{i + 1}</span>
                  <TextInput
                    aria-label={t("Item {n} as printed", { n: i + 1 })}
                    dir="auto"
                    value={l.rawName} onChange={(e) => update(l.key, { rawName: e.target.value })} className="font-medium" />
                  <IconButton label={t("Remove item {n}", { n: i + 1 })} danger onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
                <div className="grid grid-cols-2 gap-3 ps-8 sm:grid-cols-5">
                  <Field label={t("Qty")}>
                    <TextInput dir="ltr" inputMode="decimal" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} />
                  </Field>
                  <Field label={t("Unit")}>
                    <TextInput dir="auto" value={l.unit} onChange={(e) => update(l.key, { unit: e.target.value })} placeholder={t("kg, Pcs…")} />
                  </Field>
                  <Field label={t("Unit price")}>
                    <TextInput dir="ltr" inputMode="decimal" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} />
                  </Field>
                  <Field label={t("Line total")}>
                    <TextInput dir="ltr" inputMode="decimal" value={l.lineTotal} onChange={(e) => update(l.key, { lineTotal: e.target.value })} />
                  </Field>
                  <Field label={t("Type")} className="col-span-2 sm:col-span-1">
                    <Select value={l.category} onChange={(e) => update(l.key, { category: e.target.value as Category })}>
                      {SPEND_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t(CATEGORY_LABEL[c])}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {isStock(l.category) && (
                  <div className="ms-8 grid gap-3 rounded-[12px] bg-black-iron/[0.025] p-3 sm:grid-cols-[1fr_auto]">
                    <Field
                      label={t("Ingredient")}
                      hint={
                        known
                          ? t("Existing ingredient")
                          : l.ingredientName.trim()
                            ? t("New ingredient")
                            : t("Leave empty to keep it out of stock")
                      }
                    >
                      <TextInput
                        list="ops-ingredients"
                        dir="auto"
                        value={l.ingredientName}
                        onChange={(e) => update(l.key, { ingredientName: e.target.value })}
                        placeholder={t("e.g. Sella rice")}
                      />
                    </Field>
                    <Field
                      label={t("Stock added")}
                      hint={
                        <>
                          {stockBase != null && stockBase > 0 ? amountText(stockBase, unit, locale) : t("Total for this line")}
                          {l.source && (
                            <span className="ms-1.5 inline-flex items-center gap-1 text-terracotta-ink">
                              <Sparkles className="h-3 w-3" />
                              {t(SOURCE_LABEL[l.source])}
                            </span>
                          )}
                        </>
                      }
                    >
                      <div className="flex gap-2">
                        <TextInput dir="ltr" inputMode="decimal" value={l.stock} onChange={(e) => update(l.key, { stock: e.target.value })} className="w-28" />
                        <select
                          aria-label={t("Stock unit")}
                          value={unit}
                          disabled={!!known}
                          onChange={(e) => update(l.key, { stockUnit: e.target.value as BaseUnit })}
                          className={cn(controlClass, "h-11 w-20")}
                        >
                          {(["g", "ml", "pcs"] as const).map((u) => (
                            <option key={u} value={u}>
                              {t(DISPLAY_UNIT[u])}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Field>
                  </div>
                )}
                {lineFlags(i).length > 0 && <Flags flags={lineFlags(i)} className="ms-8" compact />}
              </li>
            );
          })}
        </ul>
        <datalist id="ops-ingredients">
          {ingredients.map((i) => (
            <option key={i.id} value={i.name} />
          ))}
        </datalist>
        <div className="border-t border-black-iron/[0.06] px-5 py-3 md:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setLines((ls) => [
                ...ls,
                {
                  key: `n${Date.now()}`,
                  rawName: "",
                  itemCode: null,
                  quantity: "1",
                  unit: "",
                  unitPrice: "",
                  lineTotal: "",
                  discount: 0,
                  vat: null,
                  category: "food",
                  ingredientName: "",
                  stockUnit: "g",
                  stock: "",
                  source: null,
                  confidence: 1,
                  note: null,
                },
              ])
            }
          >
            <Plus className="h-4 w-4" /> {t("Add item")}
          </Button>
        </div>
      </Card>

      <Card title={t("Totals (AED)")}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label={t("Subtotal", { context: "invoice" })}>
            <TextInput dir="ltr" inputMode="decimal" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
          </Field>
          <Field label={t("Discount")}>
            <TextInput dir="ltr" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <Field label={t("VAT")}>
            <TextInput dir="ltr" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} />
          </Field>
          <Field label={t("Total")} required>
            <TextInput dir="ltr" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className="font-semibold" />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-black-iron/[0.07] bg-warm-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-[16px] sm:border">
        <Button onClick={save} disabled={!!busy}>
          {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Save to stock")}
        </Button>
        {errors > 0 ? (
          <StatusPill tone="bad">
            {t("{n} to check", { n: errors })}
          </StatusPill>
        ) : (
          <StatusPill tone="good">{t("Numbers add up")}</StatusPill>
        )}
        <div className="ms-auto flex gap-1">
          {!manual && (
            <Button variant="ghost" size="sm" onClick={readAgain} disabled={!!busy}>
              {busy === "read" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />} {t("Read again")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={discard} disabled={!!busy} className="text-pomegranate-red hover:bg-pomegranate-red/[0.08]">
            {t("Discard")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/*
 * Check messages come from lib/ops/checks in English (with numbers
 * filled in); these patterns turn the ones with numbers back into
 * dictionary sentences. Anything else is looked up as is.
 */
function flagText(message: string, t: Translate): string {
  let m: RegExpMatchArray | null;
  if ((m = message.match(/^The date (.+) is in the future — check it\.$/))) return t("The date {date} is in the future — check it.", { date: m[1] });
  if ((m = message.match(/^The date (.+) is over a year ago — check it\.$/))) return t("The date {date} is over a year ago — check it.", { date: m[1] });
  if ((m = message.match(/^TRN "(.*)" is not 15 digits — check it\.$/))) return t('TRN "{trn}" is not 15 digits — check it.', { trn: m[1] });
  if ((m = message.match(/^(\S+) × (\S+) = (\S+), but the line says (\S+)\.$/)))
    return t("{qty} × {price} = {expected}, but the line says {total}.", { qty: m[1], price: m[2], expected: m[3], total: m[4] });
  if ((m = message.match(/^Unsure: ([\s\S]*)$/))) return t("Unsure: {note}", { note: m[1] });
  if ((m = message.match(/^Lines add up to (\S+), but the subtotal says (\S+)\.$/)))
    return t("Lines add up to {lines}, but the subtotal says {subtotal}.", { lines: m[1], subtotal: m[2] });
  if ((m = message.match(/^(Subtotal|Lines) (\S+)(?: − discount (\S+))?(?: \+ VAT (\S+))? doesn't match the total (\S+)\.$/))) {
    const sum =
      t(m[1] === "Subtotal" ? "Subtotal {amount}" : "Lines {amount}", { amount: m[2] }) +
      (m[3] ? ` − ${t("discount {amount}", { amount: m[3] })}` : "") +
      (m[4] ? ` + ${t("VAT {amount}", { amount: m[4] })}` : "");
    return t("{sum} doesn't match the total {total}.", { sum, total: m[5] });
  }
  return t(message);
}

export function Flags({ flags, className, compact }: { flags: Flag[]; className?: string; compact?: boolean }) {
  const { t } = useAdminI18n();
  const icon = { error: XCircle, warn: AlertTriangle, info: Info };
  const tone = { error: "text-pomegranate-red", warn: "text-cinnamon-bark", info: "text-dark-grey" };
  return (
    <ul className={cn("space-y-1.5", !compact && "rounded-[16px] border border-black-iron/[0.07] bg-white p-4", className)}>
      {flags.map((f, i) => {
        const Icon = icon[f.level];
        return (
          <li key={i} className={cn("flex items-start gap-2 text-[13px]", tone[f.level])}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{flagText(f.message, t)}</span>
          </li>
        );
      })}
    </ul>
  );
}
