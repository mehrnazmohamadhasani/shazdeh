"use client";
import * as React from "react";
import Image from "next/image";
import { Check, ChevronDown, Leaf } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { cart, type CartLine } from "@/components/order/cart-store";
import { formatFils } from "@/lib/ordering/money";
import { unitPriceFils, validateSelection, type PricingGroup } from "@/lib/ordering/pricing";
import { variantToPricingItem, type OrderProduct } from "@/lib/ordering/types";
import { cn } from "@/lib/utils";

/*
 * Product sheet — the "customise and add" moment. Bottom sheet on
 * phones, centred card on desktop. One scrolling column with the
 * add button pinned to the bottom so it's always under the thumb.
 */

export type SheetTarget = { product: OrderProduct; editing?: CartLine } | null;

function defaultSelection(groups: PricingGroup[]) {
  // Pre-pick the free option of a required single choice: one fewer tap.
  const out: Record<string, string[]> = {};
  for (const g of groups) {
    const free = g.options.find((o) => o.isAvailable && o.priceFils === 0);
    out[g.id] = g.minSelect === 1 && g.maxSelect === 1 && free ? [free.id] : [];
  }
  return out;
}

export function ProductSheet({
  target,
  onClose,
  canOrder,
}: {
  target: SheetTarget;
  onClose: () => void;
  canOrder: boolean;
}) {
  // Keep the last product mounted while the close animation plays.
  const [shown, setShown] = React.useState(target);
  if (target && target !== shown) setShown(target);
  const t = target ?? shown;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]" closeClassName="bg-warm-white shadow-sm">
        {t && <SheetBody key={`${t.product.key}:${t.editing?.key ?? "new"}`} target={t} onDone={onClose} canOrder={canOrder} />}
      </DialogContent>
    </Dialog>
  );
}

function SheetBody({
  target,
  onDone,
  canOrder,
}: {
  target: NonNullable<SheetTarget>;
  onDone: () => void;
  canOrder: boolean;
}) {
  const { product, editing } = target;
  const initialVariant = Math.max(
    0,
    editing
      ? product.variants.findIndex((v) => v.itemId === editing.itemId)
      : product.variants.findIndex((v) => v.orderable),
  );
  const [variantIndex, setVariantIndex] = React.useState(initialVariant);
  const variant = product.variants[variantIndex];
  const [selection, setSelection] = React.useState<Record<string, string[]>>(() => {
    if (!editing) return defaultSelection(variant.groups);
    const out: Record<string, string[]> = {};
    for (const g of variant.groups) out[g.id] = g.options.filter((o) => editing.optionIds.includes(o.id)).map((o) => o.id);
    return out;
  });
  const [quantity, setQuantity] = React.useState(editing?.quantity ?? 1);
  const [notes, setNotes] = React.useState(editing?.notes ?? "");
  const [showNotes, setShowNotes] = React.useState(!!editing?.notes);
  const [attempted, setAttempted] = React.useState(false);

  function chooseVariant(i: number) {
    setVariantIndex(i);
    setSelection(defaultSelection(product.variants[i].groups));
  }

  const optionIds = Object.values(selection).flat();
  const item = variantToPricingItem(product, variant);
  const error = validateSelection(item, optionIds);
  const unit = unitPriceFils(item, optionIds);

  function toggle(group: PricingGroup, optionId: string) {
    setSelection((s) => {
      const current = s[group.id] ?? [];
      if (group.maxSelect === 1) return { ...s, [group.id]: current[0] === optionId && group.minSelect === 0 ? [] : [optionId] };
      if (current.includes(optionId)) return { ...s, [group.id]: current.filter((id) => id !== optionId) };
      if (current.length >= group.maxSelect) return s;
      return { ...s, [group.id]: [...current, optionId] };
    });
  }

  function submit() {
    setAttempted(true);
    if (error || !variant.orderable) return;
    if (editing) cart.replace(editing.key, variant.itemId, optionIds, quantity, notes);
    else cart.add(variant.itemId, optionIds, quantity, notes);
    toast.success(editing ? "Basket updated" : `Added ${quantity > 1 ? `${quantity} × ` : ""}${product.title}`, {
      duration: 1800,
      position: "top-center", // never over the basket bar
    });
    onDone();
  }


  return (
    <div className="flex flex-col">
      <div className="relative aspect-[16/11] w-full shrink-0 bg-cream sm:aspect-[16/10]">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.title} fill sizes="(min-width: 640px) 560px, 100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-[family-name:var(--font-logo)] text-8xl text-black-iron/10">
            {product.title[0]}
          </div>
        )}
      </div>

      <div className="px-5 pb-4 pt-6 sm:px-8">
        <p className="eyebrow eyebrow-accent">{product.categoryName}</p>
        <DialogTitle className="mt-3 text-[1.75rem] sm:text-[2rem]">{product.title}</DialogTitle>
        {product.nameFa && (
          <p lang="fa" dir="rtl" className="mt-2 text-left text-[15px] text-dark-grey">
            {product.nameFa}
          </p>
        )}
        {product.description ? (
          <DialogDescription className="mt-4">{product.description}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">Customise {product.title}</DialogDescription>
        )}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-dark-grey">
          {product.isVegetarian && (
            <span className="inline-flex items-center gap-1.5 text-olive-leaf">
              <Leaf className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden /> Vegetarian
            </span>
          )}
        </div>

        {(product.ingredients || product.allergens) ? (
          <details className="group mt-5 rounded-[12px] border border-black-iron/10 px-4">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[13px] font-medium [&::-webkit-details-marker]:hidden">
              Ingredients & allergens
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={1.5} />
            </summary>
            <dl className="space-y-3 pb-4 text-[13.5px] leading-[1.6]">
              {product.ingredients && (
                <div>
                  <dt className="caption">Ingredients</dt>
                  <dd className="mt-1">{product.ingredients}</dd>
                </div>
              )}
              {product.allergens && (
                <div>
                  <dt className="caption">Allergens</dt>
                  <dd className="mt-1">{product.allergens}</dd>
                </div>
              )}
            </dl>
          </details>
        ) : (
          <p className="mt-5 text-[12.5px] leading-[1.6] text-dark-grey">
            Allergen details for this dish aren&apos;t listed yet. If you have an allergy, please contact us before ordering.
          </p>
        )}
      </div>

      {product.variants.length > 1 && (
        <OptionSection title="Size" hint="Required" invalid={false}>
          <div role="radiogroup" aria-label="Size" className="grid grid-cols-2 gap-2">
            {product.variants.map((v, i) => (
              <button
                key={v.itemId}
                type="button"
                role="radio"
                aria-checked={i === variantIndex}
                disabled={!v.orderable}
                onClick={() => chooseVariant(i)}
                className={cn(
                  "flex min-h-14 flex-col items-start justify-center rounded-[12px] border px-4 py-2 text-left transition-colors disabled:opacity-40",
                  i === variantIndex ? "border-black-iron bg-black-iron text-warm-white" : "border-black-iron/15 hover:border-black-iron/40",
                )}
              >
                <span className="text-[14px] font-semibold">{v.portion ?? "Regular"}</span>
                <span className={cn("text-[12.5px] tabular-nums", i === variantIndex ? "text-warm-white/75" : "text-dark-grey")}>
                  {v.orderable ? formatFils(v.priceFils) : "Sold out"}
                </span>
              </button>
            ))}
          </div>
        </OptionSection>
      )}

      {variant.groups.map((g) => {
        const chosen = selection[g.id] ?? [];
        const groupError = attempted && validateSelection({ ...item, groups: [g] }, chosen);
        const hint =
          g.minSelect > 0
            ? g.maxSelect === 1
              ? "Required · choose 1"
              : `Required · choose ${g.minSelect}–${g.maxSelect}`
            : g.maxSelect === 1
              ? "Optional"
              : `Optional · up to ${g.maxSelect}`;
        return (
          <OptionSection key={g.id} title={g.name} hint={hint} invalid={!!groupError}>
            <ul role={g.maxSelect === 1 ? "radiogroup" : "group"} aria-label={g.name} className="divide-y divide-black-iron/[0.07]">
              {g.options.map((o) => {
                const on = chosen.includes(o.id);
                const full = !on && g.maxSelect > 1 && chosen.length >= g.maxSelect;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      role={g.maxSelect === 1 ? "radio" : "checkbox"}
                      aria-checked={on}
                      disabled={!o.isAvailable || full}
                      onClick={() => toggle(g, o.id)}
                      className="flex min-h-14 w-full items-center gap-3.5 py-2 text-left disabled:opacity-40"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-[22px] w-[22px] shrink-0 place-items-center border transition-colors",
                          g.maxSelect === 1 ? "rounded-full" : "rounded-[6px]",
                          on ? "border-terracotta bg-terracotta text-white" : "border-black-iron/30",
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={2.4} />}
                      </span>
                      <span className="flex-1 text-[14.5px]">
                        {o.name}
                        {!o.isAvailable && <span className="ml-2 text-[12px] text-dark-grey">Sold out</span>}
                      </span>
                      {o.priceFils > 0 && (
                        <span className="text-[13.5px] tabular-nums text-dark-grey">+{formatFils(o.priceFils)}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {groupError && <p className="mt-2 text-[12.5px] font-medium text-rose-sumac">{groupError}</p>}
          </OptionSection>
        );
      })}

      <div className="px-5 pb-6 pt-2 sm:px-8">
        {showNotes ? (
          <label className="block">
            <span className="caption">Special instructions</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="e.g. no onions, sauce on the side"
              className="mt-2 w-full resize-none rounded-[12px] border border-black-iron/15 bg-transparent px-4 py-3 text-[14px] focus:border-terracotta/60 focus:outline-none focus:ring-1 focus:ring-terracotta/40"
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="min-h-11 text-[13px] font-medium text-terracotta-ink underline-offset-4 hover:underline"
          >
            + Add special instructions
          </button>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-black-iron/10 bg-warm-white/95 px-5 py-4 backdrop-blur pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
        {variant.orderable && canOrder && (
          <QuantityStepper value={quantity} onChange={(q) => setQuantity(Math.max(1, q))} label={product.title} />
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!variant.orderable || !canOrder}
          className="flex h-12 flex-1 items-center justify-between gap-3 rounded-full bg-terracotta px-6 text-[13px] font-semibold text-white transition-colors hover:bg-terracotta-ink disabled:bg-black-iron/25"
        >
          <span>{!variant.orderable ? "Sold out" : !canOrder ? "Ordering paused" : editing ? "Update basket" : "Add to basket"}</span>
          {variant.orderable && canOrder && <span className="tabular-nums">{formatFils(unit * quantity)}</span>}
        </button>
      </div>
    </div>
  );
}

function OptionSection({
  title,
  hint,
  invalid,
  children,
}: {
  title: string;
  hint: string;
  invalid: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t-[6px] border-cream px-5 py-5 sm:px-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="text-[16px] font-bold tracking-[-0.02em]">{title}</h3>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em]",
            invalid ? "bg-rose-sumac text-white" : hint.startsWith("Required") ? "bg-black-iron/[0.06] text-black-iron" : "text-dark-grey",
          )}
        >
          {hint}
        </span>
      </div>
      {children}
    </section>
  );
}
