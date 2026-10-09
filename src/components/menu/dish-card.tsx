"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { DishCardData } from "@/lib/dish";
import { formatPrice, cn } from "@/lib/utils";

export type { DishCardData } from "@/lib/dish";

/*
 * Editorial dish card. Three layouts:
 *   – card    : 4:5 photograph, name + price beneath (menu grid)
 *   – row     : magazine-style row with a small thumbnail (list view)
 *   – feature : arch-framed photograph — the brand's iwan motif —
 *               used for the home page signature dishes
 *
 * Each card is an <article>; the dish name is a real heading whose
 * button is stretched over the whole card, so the card is one large
 * target while screen readers get a clean "heading → button" pair.
 */

export function DishCard({
  dish,
  layout = "card",
  onSelect,
  href,
  imagePriority = false,
}: {
  dish: DishCardData;
  layout?: "card" | "row" | "feature";
  /** Opens a quick view (menu) … */
  onSelect?: (dish: DishCardData) => void;
  /** … or navigates (related dishes on a dish page). */
  href?: string;
  imagePriority?: boolean;
}) {
  const soldOut = !dish.isAvailable;

  const nameButton = href ? (
    <Link href={href} className="stretched focus-visible:outline-none">
      {dish.title}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => onSelect?.(dish)}
      className="stretched [text-align:inherit] focus-visible:outline-none"
    >
      {dish.title}
    </button>
  );

  const focusRing =
    "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-terracotta";

  if (layout === "row") {
    return (
      <article
        className={cn(
          "group relative flex items-start gap-5 rounded-sm border-t border-[var(--color-border)] py-6 md:gap-8 md:py-7",
          focusRing,
        )}
      >
        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-sm bg-[var(--color-card)] md:h-28 md:w-24">
          {dish.imageUrl && (
            <Image
              src={dish.imageUrl}
              alt=""
              fill
              sizes="96px"
              className={cn("img-zoom object-cover", soldOut && "opacity-50 grayscale")}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="t-h3 transition-colors duration-300 group-hover:text-terracotta-ink">
                {nameButton}
              </h3>
              <DishSubtitle dish={dish} className="mt-1.5" />
            </div>
            <Price dish={dish} className="mt-1 text-base md:text-lg" />
          </div>
          {dish.description && (
            <p className="t-body mt-3 line-clamp-2 max-w-2xl text-dark-grey">
              {dish.description}
            </p>
          )}
        </div>
      </article>
    );
  }

  if (layout === "feature") {
    return (
      <article className={cn("group relative", focusRing)}>
        <div className="arch relative aspect-[4/5] overflow-hidden bg-[var(--color-card)]">
          {dish.imageUrl && (
            <Image
              src={dish.imageUrl}
              alt=""
              fill
              preload={imagePriority}
              sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 88vw"
              className="img-zoom object-cover"
            />
          )}
        </div>
        <div className="mt-6 text-center">
          <p className="caption">{dish.category.name}</p>
          <h3 className="t-h3 mt-3 transition-colors duration-300 group-hover:text-terracotta-ink">
            {nameButton}
          </h3>
          <DishSubtitle dish={dish} className="mt-2 justify-center" />
          <Price dish={dish} className="mt-3 block text-[15px]" />
        </div>
      </article>
    );
  }

  return (
    <article className={cn("group relative rounded-sm", focusRing)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-[var(--color-card)]">
        {dish.imageUrl ? (
          <Image
            src={dish.imageUrl}
            alt=""
            fill
            preload={imagePriority}
            sizes="(min-width: 1280px) 26vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            className={cn("img-zoom object-cover", soldOut && "opacity-50 grayscale")}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-[family-name:var(--font-logo)] text-7xl text-black-iron/15">
              {dish.title[0]}
            </span>
          </div>
        )}
        <div className="absolute left-3 top-3 z-[2] flex flex-wrap gap-1.5">
          {soldOut && <Badge variant="solid">Sold out</Badge>}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-1.5 sm:mt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold leading-tight tracking-[-0.02em] transition-colors duration-300 group-hover:text-terracotta-ink sm:text-[1.1875rem] sm:tracking-[-0.025em] md:text-xl">
            {nameButton}
          </h3>
          <DishSubtitle dish={dish} className="mt-1.5" />
        </div>
        <Price dish={dish} className="text-[14px] sm:mt-0.5 sm:text-[15px]" />
      </div>
      {dish.description && (
        <p className="mt-2.5 line-clamp-2 text-[14px] leading-[1.6] text-dark-grey max-sm:hidden">
          {dish.description}
        </p>
      )}
    </article>
  );
}

/** Portion · Persian name, e.g. "Large · فسنجان" */
export function DishSubtitle({
  dish,
  className,
}: {
  dish: DishCardData;
  className?: string;
}) {
  if (!dish.portion && !dish.nameFa) return null;
  return (
    <p className={cn("flex items-baseline gap-2 text-[13px] text-dark-grey", className)}>
      {dish.portion && (
        <span className="text-[10.5px] font-medium uppercase tracking-[0.18em]">
          {dish.portion}
        </span>
      )}
      {dish.portion && dish.nameFa && <span aria-hidden>·</span>}
      {dish.nameFa && (
        <span lang="fa" dir="rtl" className="text-[14px]">
          {dish.nameFa}
        </span>
      )}
    </p>
  );
}

function Price({ dish, className }: { dish: DishCardData; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 font-semibold tabular-nums tracking-[-0.01em] text-terracotta-ink",
        className,
      )}
    >
      {formatPrice(dish.price)}
    </span>
  );
}
