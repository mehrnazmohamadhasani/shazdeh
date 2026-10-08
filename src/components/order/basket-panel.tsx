"use client";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, ArrowRight, ShoppingBag } from "lucide-react";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { cart, type CartLine } from "@/components/order/cart-store";
import { useBasket, useOrderData } from "@/components/order/order-data";
import { formatFils } from "@/lib/ordering/money";
import type { OrderProduct } from "@/lib/ordering/types";
import { cn } from "@/lib/utils";

/*
 * The basket. Updates instantly (pure client math); the authoritative
 * total is confirmed by the server at checkout.
 */
export function BasketPanel({
  onEdit,
  onChooseArea,
  onNavigate,
  className,
}: {
  onEdit: (product: OrderProduct, line: CartLine) => void;
  onChooseArea: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const { config } = useOrderData();
  const basket = useBasket();
  const { totals, zone, area } = basket;
  const empty = basket.lines.length === 0 && basket.stale.length === 0;
  const blocked = !config.canOrder;
  const needsArea = !zone;
  const belowMin = totals.shortOfMinimumFils > 0;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-baseline justify-between px-5 pb-3 pt-6 sm:px-6">
        <h2 className="text-[1.375rem] font-bold tracking-[-0.03em]">Your basket</h2>
        {!empty && (
          <span className="text-[12px] tabular-nums text-dark-grey">
            {basket.count} item{basket.count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {empty ? (
        <div className="flex flex-col items-center px-6 pb-10 pt-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-cream">
            <ShoppingBag className="h-6 w-6 text-terracotta-ink" strokeWidth={1.4} />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Your basket is empty</p>
          <p className="mt-1 max-w-[16rem] text-[13.5px] text-dark-grey">
            Add a khoresh, some saffron rice and a cooling mast — we&apos;ll take it from there.
          </p>
        </div>
      ) : (
        <>
          {basket.stale.length > 0 && (
            <div role="alert" className="mx-5 mb-3 rounded-[12px] bg-rose-sumac/[0.08] p-4 text-[13px] sm:mx-6">
              <p className="flex items-center gap-2 font-semibold text-rose-sumac">
                <AlertCircle className="h-4 w-4" strokeWidth={1.8} /> Some items changed
              </p>
              <ul className="mt-2 space-y-1 text-black-iron/80">
                {basket.stale.map((s) => (
                  <li key={s.line.key}>
                    {s.name} — {s.message}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => cart.removeLines(basket.stale.map((s) => s.line.key))}
                className="mt-3 min-h-10 text-[12.5px] font-semibold underline underline-offset-4"
              >
                Remove them
              </button>
            </div>
          )}

          <ul className="divide-y divide-black-iron/[0.07] px-5 sm:px-6">
            {basket.lines.map((l) => (
              <li key={l.line.key} className="flex gap-3 py-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[10px] bg-cream">
                  {l.product.imageUrl && (
                    <Image src={l.product.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-semibold leading-snug">
                      {l.name}
                      {l.portion && <span className="font-normal text-dark-grey"> · {l.portion}</span>}
                    </p>
                    <span className="shrink-0 text-[13.5px] font-medium tabular-nums">{formatFils(l.lineTotalFils)}</span>
                  </div>
                  {l.modifiers.length > 0 && (
                    <p className="mt-0.5 text-[12.5px] leading-snug text-dark-grey">{l.modifiers.map((m) => m.name).join(" · ")}</p>
                  )}
                  {l.notes && <p className="mt-0.5 text-[12.5px] italic leading-snug text-dark-grey">“{l.notes}”</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <QuantityStepper
                      size="sm"
                      removable
                      value={l.quantity}
                      onChange={(q) => cart.setQuantity(l.line.key, q)}
                      label={l.name}
                    />
                    <button
                      type="button"
                      onClick={() => onEdit(l.product, l.line)}
                      className="min-h-9 px-2 text-[12.5px] font-medium text-terracotta-ink underline-offset-4 hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mx-5 mt-2 border-t border-black-iron/10 pt-4 sm:mx-6">
            {needsArea ? (
              <button
                type="button"
                onClick={onChooseArea}
                className="mb-4 flex min-h-12 w-full items-center justify-between rounded-[12px] bg-cream px-4 text-left text-[13.5px] font-medium"
              >
                Choose your area to see delivery fee
                <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
              </button>
            ) : (
              <>
                {belowMin && (
                  <MinimumBar short={totals.shortOfMinimumFils} min={zone.minOrderFils} area={area?.name ?? zone.name} />
                )}
                {!belowMin && totals.shortOfFreeDeliveryFils !== null && totals.shortOfFreeDeliveryFils > 0 && (
                  <p className="mb-3 rounded-[10px] bg-olive-leaf/[0.08] px-3 py-2.5 text-[12.5px] text-olive-leaf">
                    Add {formatFils(totals.shortOfFreeDeliveryFils)} more for free delivery.
                  </p>
                )}
              </>
            )}

            <dl className="space-y-2 text-[13.5px]">
              <Row label="Subtotal" value={formatFils(totals.subtotalFils)} />
              {zone && (
                <Row
                  label="Delivery"
                  value={totals.deliveryFeeFils === 0 ? "Free" : formatFils(totals.deliveryFeeFils)}
                />
              )}
              {totals.serviceFeeFils > 0 && <Row label="Service fee" value={formatFils(totals.serviceFeeFils)} />}
              {!config.pricesIncludeVat && <Row label={`VAT ${config.vatRate}%`} value={formatFils(totals.vatFils)} />}
              <div className="flex items-baseline justify-between border-t border-black-iron/10 pt-3 text-[15px] font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatFils(totals.totalFils)}</dd>
              </div>
            </dl>
            <p className="mt-1.5 text-[11.5px] text-dark-grey">
              {config.pricesIncludeVat ? `Prices include ${config.vatRate}% VAT. ` : ""}Promo codes can be added at checkout.
            </p>
          </div>

          <div className="sticky bottom-0 mt-4 bg-inherit px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 sm:px-6">
            {blocked ? (
              <p className="rounded-[12px] bg-black-iron/[0.05] px-4 py-3 text-center text-[13px] text-dark-grey">
                {config.acceptingOrders ? `Kitchen closed — ${config.kitchenLabel.toLowerCase()}` : "Online ordering is paused"}
              </p>
            ) : needsArea ? (
              <button
                type="button"
                onClick={onChooseArea}
                className="flex h-13 min-h-12 w-full items-center justify-center rounded-full bg-black-iron text-[13px] font-semibold text-warm-white"
              >
                Choose delivery area
              </button>
            ) : (
              <Link
                href="/order/checkout"
                onClick={onNavigate}
                aria-disabled={belowMin || basket.lines.length === 0}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between rounded-full px-6 text-[13px] font-semibold transition-colors",
                  belowMin || basket.lines.length === 0
                    ? "pointer-events-none bg-black-iron/20 text-white"
                    : "bg-terracotta text-white hover:bg-terracotta-ink",
                )}
              >
                <span>Go to checkout</span>
                <span className="tabular-nums">{formatFils(totals.totalFils)}</span>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-dark-grey">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function MinimumBar({ short, min, area }: { short: number; min: number; area: string }) {
  const pct = Math.max(4, Math.min(100, ((min - short) / min) * 100));
  return (
    <div className="mb-4">
      <p className="text-[12.5px]">
        Add <strong className="tabular-nums">{formatFils(short)}</strong> to reach the {formatFils(min)} minimum for {area}.
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black-iron/[0.08]" aria-hidden>
        <div className="h-full rounded-full bg-terracotta transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
