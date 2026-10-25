"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Info, Loader2, Plus, RotateCw, Sparkles, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Field, Select, StatusPill, TextArea, TextInput, controlClass } from "@/components/admin/ui";
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
import { IngredientPicker, IngredientStatus } from "@/components/admin/ops/ingredient-picker";
import { ChangeUnitButton } from "@/components/admin/ops/forms";

/*
 * Review screen for one AI reading. Everything is pre-filled and
 * editable; the arithmetic checks re-run on every keystroke, so fixing
 * a number clears its warning. Stock is entered in kg / L / pieces and
 * stored in g / ml / pieces.
 */

type Category = (typeof SPEND_CATEGORIES)[number];
type Known = { id: string; name: string };
type KnownSupplier = Known & { trn: string | null; phone: string | null; paymentTermsDays: number | null };
type KnownIngredient = Known & { unit: BaseUnit; nameFa?: string | null; meatTypeId?: string | null };

type LineState = {
  key: string;
  /** Added on this screen (not on the paper). */
  added?: boolean;
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
  /** Kind of meat chosen on this screen, or found by the reading; undefined = the ingredient's own (unchanged). */
  meatTypeId?: string | null;
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
  meatTypes = [],
  manual = false,
}: {
  documentId: string;
  reading: Extraction;
  suggestions: Suggestions;
  suppliers: KnownSupplier[];
  ingredients: KnownIngredient[];
  /** Kinds of meat (lamb, beef…): the reading marks each raw-meat line with one; editable here. */
  meatTypes?: { id: string; name: string; nameFa: string | null; countPieces: boolean }[];
  /** Typed in by hand: there is no photo to read again. */
  manual?: boolean;
}) {
  const { t, locale, money } = useAdminI18n();
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
      // Lamb shank (a kind counted in pieces) is bought by the kg and stocked in pieces:
      // the pieces are counted and typed, never worked out from the weight.
      const byPiece = !!meatTypes.find((m) => m.id === s?.meatTypeId)?.countPieces;
      const known = s?.ingredientId ? ingredients.find((i) => i.id === s.ingredientId) : undefined;
      const unit = known?.unit ?? (byPiece ? "pcs" : (s?.unit ?? l.stockUnit ?? "g"));
      // A suggested amount in another unit than the stock's (5 kg for an item counted in pieces) is no amount at all.
      const byWeight = /(^|[^a-z])(kg|kgs|kilo|g|gm|grams?)([^a-z]|$)|كغ|كيلو|کیلو/i.test(l.unit ?? "");
      const fits = s?.quantity != null && s.unit === unit && !(byPiece && byWeight);
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
        stock: fits ? String(Number((s!.quantity! / PER_DISPLAY[unit]).toFixed(3))) : "",
        source: s?.source ?? null,
        // The reading (or the ingredient) says it is raw meat: start with that kind.
        meatTypeId: s?.meatTypeId ?? undefined,
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

  // Each line is one summary row. Its boxes open when it needs a person:
  // something doesn't add up, the AI was unsure, or the ingredient is new
  // or missing. Quantity and unit price only show when they disagree with
  // the line total (they copy the paper; the cost uses the total).
  const needsLook = (l: LineState, i: number) => {
    const known = ingredientFor(l.ingredientName);
    return (
      l.confidence < 0.7 ||
      lineFlags(i).some((f) => f.level !== "info") ||
      (isStock(l.category) && (!known || !(num(l.stock)! > 0)))
    );
  };
  const [open, setOpen] = React.useState(() => new Set(lines.filter((l, i) => needsLook(l, i)).map((l) => l.key)));
  const mismatch = (i: number) => lineFlags(i).some((f) => f.message.includes(", but the line says "));
  const [math, setMath] = React.useState(() => new Set(lines.filter((_, i) => mismatch(i)).map((l) => l.key)));
  const [showTotals, setShowTotals] = React.useState(() => docFlags.some((f) => f.level === "error"));
  // A line that doesn't add up stays open, with its quantity and price.
  const broken = (i: number) => lineFlags(i).some((f) => f.level === "error");
  function setOpenKey(key: string, on: boolean) {
    setOpen((o) => {
      const n = new Set(o);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });
  }

  // A kind of meat counted in pieces (lamb shank) puts a new ingredient into stock in pieces;
  // a weight read from the invoice can't be pieces, so that amount is typed.
  function piecesFor(meatTypeId: string | null, l: LineState, known: KnownIngredient | null): Partial<LineState> {
    if (known || !meatTypes.find((m) => m.id === meatTypeId)?.countPieces || l.stockUnit === "pcs") return {};
    return { stockUnit: "pcs", stock: "" };
  }

  function update(key: string, patch: Partial<LineState>) {
    // Keep a line that was being fixed open after it adds up, so its boxes don't vanish mid-typing.
    const i = lines.findIndex((l) => l.key === key);
    if (i >= 0 && broken(i)) setOpen((o) => new Set(o).add(key));
    if (i >= 0 && mismatch(i)) setMath((o) => new Set(o).add(key));
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  // "Find matches with AI": a suggestion per line, shown first in its picker; never applied on its own.
  const [aiMatches, setAiMatches] = React.useState<Record<string, KnownIngredient | null>>({});
  const [matching, setMatching] = React.useState(false);
  const unmatched = lines.filter((l) => isStock(l.category) && !ingredientFor(l.ingredientName) && !(l.key in aiMatches));
  async function findWithAi() {
    setMatching(true);
    try {
      const json = (await post("match", { lines: unmatched.map((l) => ({ key: l.key, description: l.rawName })) })) as {
        matches: { key: string; ingredientId: string | null }[];
      };
      const found = Object.fromEntries(json.matches.map((m) => [m.key, ingredients.find((i) => i.id === m.ingredientId) ?? null]));
      setAiMatches((a) => ({ ...a, ...found }));
      const n = Object.values(found).filter(Boolean).length;
      if (n) toast.success(t(n === 1 ? "AI found 1 likely match — check it and tap Use" : "AI found {n} likely matches — check them and tap Use", { n }));
      else toast.message(t("AI found no match in stock. These look like new ingredients."));
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Could not ask the AI")));
    } finally {
      setMatching(false);
    }
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
      // Only the line total counts for cost; a receipt that prints no quantity is one of it.
      if (num(l.lineTotal) == null) missing.push(t("line {n} total", { n: i + 1 }));
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
          rawName: l.rawName.trim() || l.ingredientName.trim() || "Item",
          itemCode: l.itemCode,
          quantity: num(l.quantity)! > 0 ? num(l.quantity)! : 1,
          unit: l.unit.trim() || null,
          unitPrice: num(l.unitPrice),
          discount: l.discount,
          vat: l.vat,
          lineTotal: num(l.lineTotal)!,
          category: l.category,
          ingredient: stocked
            ? { id: known?.id ?? null, name: known?.name ?? l.ingredientName.trim(), unit, ...(l.meatTypeId !== undefined ? { meatTypeId: l.meatTypeId } : {}) }
            : null,
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
        </div>
        {/* What the AI read for the records; nothing here changes a cost. */}
        <details className="mt-4 text-[14px]">
          <summary className="cursor-pointer text-[13px] font-medium text-dark-grey">
            {t("More details")}
            {invoiceNo.trim() && <span className="ms-1.5 font-normal">· #{invoiceNo.trim()}</span>}
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label={t("Invoice number")}>
              <TextInput dir="ltr" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
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
            <Field label={t("Notes")} hint={t("Handwritten words on the paper are read here (e.g. «باقلی» = fava beans).")}>
              <TextArea dir="auto" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </details>
      </Card>

      <Card
        title={t("Items ({n})", { n: lines.length })}
        description={t("Check that each item goes to the right ingredient. Tap Edit to change one.")}
        bodyClassName="p-0"
        actions={
          unmatched.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void findWithAi()} disabled={matching}>
              {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t("Find matches with AI")}
            </Button>
          )
        }
      >
        <ul className="divide-y divide-black-iron/[0.06]">
          {lines.map((l, i) => {
            const known = ingredientFor(l.ingredientName);
            const unit = known?.unit ?? l.stockUnit;
            const stockBase = num(l.stock) != null ? num(l.stock)! * PER_DISPLAY[unit] : null;
            const stocked = isStock(l.category) && !!l.ingredientName.trim();
            const meatId = l.category === "food" ? (l.meatTypeId !== undefined ? l.meatTypeId : known?.meatTypeId) : null;
            const meat = meatId ? meatTypes.find((m) => m.id === meatId) : null;
            const flagsHere = lineFlags(i);
            const isOpen = open.has(l.key) || broken(i);
            const lineTotal = num(l.lineTotal);
            return (
              <li key={l.key} className={cn("px-5 py-3.5 md:px-6", (l.confidence < 0.7 || flagsHere.some((f) => f.level === "error")) && "bg-saffron-orange/[0.05]")}>
                {/* One row: what was bought, where it goes, what it cost. */}
                <div className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-[12px] tabular-nums text-dark-grey">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate text-[14.5px] font-medium">
                      {l.rawName.trim() || l.ingredientName.trim() || t("New item")}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-dark-grey">
                      {stocked ? (
                        <>
                          {known ? <Check className="h-3.5 w-3.5 text-olive-leaf" /> : <Plus className="h-3.5 w-3.5 text-cinnamon-bark" />}
                          <bdi dir="auto" className={cn(!known && "text-cinnamon-bark")}>
                            {known
                              ? same(known.name, l.rawName) && !(locale === "fa" && known.nameFa)
                                ? t("In stock")
                                : locale === "fa" && known.nameFa
                                  ? known.nameFa
                                  : known.name
                              : t("New: {name}", { name: l.ingredientName.trim() })}
                          </bdi>
                          {stockBase != null && stockBase > 0 && <span className="tabular-nums">· +{amountText(stockBase, unit, locale)}</span>}
                          {meat && <span>· {locale === "fa" && meat.nameFa ? meat.nameFa : meat.name}</span>}
                        </>
                      ) : isStock(l.category) ? (
                        <span className="text-cinnamon-bark">{t("No ingredient yet")}</span>
                      ) : (
                        <span>
                          {t(CATEGORY_LABEL[l.category])} · {t("not stock")}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-[14.5px] font-semibold tabular-nums">{lineTotal != null ? money(Math.round(lineTotal * 100)) : "—"}</span>
                  {!broken(i) && (
                    <Button variant="ghost" size="sm" onClick={() => setOpenKey(l.key, !isOpen)} aria-expanded={isOpen}>
                      {isOpen ? t("Close") : t("Edit")}
                    </Button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-3 ps-8">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {!isStock(l.category) && (l.added || !l.rawName.trim()) && (
                        <Field label={t("Item")} className="col-span-2 sm:col-span-1">
                          <TextInput dir="auto" value={l.rawName} onChange={(e) => update(l.key, { rawName: e.target.value })} placeholder={t("e.g. {example}", { example: t("Gas cylinder") })} />
                        </Field>
                      )}
                      <Field label={t("Type")}>
                        <Select value={l.category} onChange={(e) => update(l.key, { category: e.target.value as Category })}>
                          {SPEND_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {t(CATEGORY_LABEL[c])}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label={t("Line total")}>
                        <TextInput dir="ltr" inputMode="decimal" value={l.lineTotal} onChange={(e) => update(l.key, { lineTotal: e.target.value })} />
                      </Field>
                      {/* Quantity and price only matter when they don't match the line total. */}
                      {(math.has(l.key) || mismatch(i)) && (
                        <>
                          <Field label={t("Qty")}>
                            <TextInput dir="ltr" inputMode="decimal" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} />
                          </Field>
                          <Field label={t("Unit price")}>
                            <TextInput dir="ltr" inputMode="decimal" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} />
                          </Field>
                        </>
                      )}
                    </div>
                    {isStock(l.category) && (
                      <div className="grid gap-3 rounded-[12px] bg-black-iron/[0.025] p-3 2xl:grid-cols-[minmax(0,1fr)_auto]">
                        <Field
                          label={t("Ingredient")}
                          htmlFor={`${l.key}-ingredient`}
                          hint={
                            <IngredientStatus
                              value={l.ingredientName}
                              ingredients={ingredients}
                              printed={l.rawName}
                              aiSuggestion={aiMatches[l.key]}
                              onUse={(name) => update(l.key, { ingredientName: name })}
                            />
                          }
                        >
                          <IngredientPicker
                            id={`${l.key}-ingredient`}
                            value={l.ingredientName}
                            onChange={(name) => update(l.key, { ingredientName: name })}
                            ingredients={ingredients}
                            printed={l.rawName}
                            aiSuggestion={aiMatches[l.key]}
                          />
                        </Field>
                        <Field
                          label={t("Stock added")}
                          hint={
                            l.source ? (
                              <span className="inline-flex items-center gap-1 text-terracotta-ink">
                                <Sparkles className="h-3 w-3" />
                                {t(SOURCE_LABEL[l.source])}
                              </span>
                            ) : (
                              t("Total for this line")
                            )
                          }
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <TextInput dir="ltr" inputMode="decimal" value={l.stock} onChange={(e) => update(l.key, { stock: e.target.value })} className="w-28" />
                            {known ? (
                              <>
                                <span className="text-[13px] text-dark-grey">{t(DISPLAY_UNIT[unit])}</span>
                                {/* An ingredient already in stock keeps one unit; changing it converts what is recorded. */}
                                <ChangeUnitButton ingredientId={known.id} name={known.name} unit={known.unit} />
                              </>
                            ) : (
                              <select
                                aria-label={t("Stock unit")}
                                value={unit}
                                onChange={(e) => update(l.key, { stockUnit: e.target.value as BaseUnit })}
                                className={cn(controlClass, "h-11 w-20")}
                              >
                                {(["g", "ml", "pcs"] as const).map((u) => (
                                  <option key={u} value={u}>
                                    {t(DISPLAY_UNIT[u])}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </Field>
                        {/* Only meat lines ask for a kind of meat: the reading marks them, or the ingredient is already meat. */}
                        {meatTypes.length > 0 && l.category === "food" && (l.meatTypeId || known?.meatTypeId) && (
                          <Field label={t("Kind of meat")} className="2xl:col-span-2">
                            <Select value={meatId ?? ""} onChange={(e) => update(l.key, { meatTypeId: e.target.value || null, ...piecesFor(e.target.value || null, l, known) })}>
                              <option value="">{t("Not raw meat")}</option>
                              {meatTypes.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {locale === "fa" && m.nameFa ? m.nameFa : m.name}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-pomegranate-red">
                      <Trash2 className="h-4 w-4" /> {t("Remove item {n}", { n: i + 1 })}
                    </button>
                  </div>
                )}
                {flagsHere.length > 0 && <Flags flags={flagsHere} className="mt-2 ms-8" compact />}
              </li>
            );
          })}
        </ul>
        <div className="border-t border-black-iron/[0.06] px-5 py-3 md:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const key = `n${Date.now()}`;
              setLines((ls) => [
                ...ls,
                {
                  key,
                  added: true,
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
              ]);
              setOpenKey(key, true);
            }}
          >
            <Plus className="h-4 w-4" /> {t("Add item")}
          </Button>
        </div>
      </Card>

      <Card title={t("Totals (AED)")}>
        <div className="flex flex-wrap items-end gap-4">
          <Field label={t("Total")} required className="w-40">
            <TextInput dir="ltr" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className="font-semibold" />
          </Field>
          {!showTotals && (
            <button type="button" onClick={() => setShowTotals(true)} className="min-h-11 text-start text-[13px] text-dark-grey">
              {[
                num(discount) ? t("discount {amount}", { amount: discount }) : null,
                num(vat) ? t("VAT {amount}", { amount: vat }) : null,
              ]
                .filter(Boolean)
                .join(" · ") || t("No discount or VAT")}
              <span className="ms-2 font-medium text-terracotta-ink admin-link">{t("Edit")}</span>
            </button>
          )}
        </div>
        {showTotals && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <Field label={t("Subtotal", { context: "invoice" })}>
              <TextInput dir="ltr" inputMode="decimal" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
            </Field>
            <Field label={t("Discount")}>
              <TextInput dir="ltr" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
            <Field label={t("VAT")}>
              <TextInput dir="ltr" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} />
            </Field>
          </div>
        )}
        <label className="mt-4 flex min-h-11 items-center gap-3 text-[14px]">
          <input type="checkbox" className="h-5 w-5 accent-terracotta" checked={pricesIncludeVat} onChange={(e) => setPricesIncludeVat(e.target.checked)} />
          {t("Line prices already include VAT")}
        </label>
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
          <Button variant="destructive-ghost" size="sm" onClick={discard} disabled={!!busy}>
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
