"use client";
import * as React from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Sparkles, Leaf, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice, cn } from "@/lib/utils";

/*
 * Editorial dish card. Three layouts:
 *   – card    : image on top, name + price below (Aesop product card)
 *   – row     : horizontal magazine-style row for list view
 *   – feature : tall hero card, used on the home signature grid
 *
 * Cards stay quiet: hairline borders, no harsh shadows, restrained
 * type. Terracotta only as a single accent (price color, signature).
 */

export type DishCardData = {
  id: string;
  slug: string;
  name: string;
  nameFa?: string | null;
  description?: string | null;
  price: number;
  currency: string;
  imageUrl?: string | null;
  spicyLevel: number;
  isVegetarian: boolean;
  isBestseller: boolean;
  isNew: boolean;
  isSignature: boolean;
  isAvailable: boolean;
  category: { name: string; slug: string };
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function DishCard({
  dish,
  layout = "card",
  onClick,
  priority = false,
}: {
  dish: DishCardData;
  layout?: "card" | "row" | "feature";
  onClick?: () => void;
  priority?: boolean;
}) {
  if (layout === "row") {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ x: 4 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="group/row w-full text-left flex items-start gap-6 md:gap-8 py-7 border-t border-[var(--color-border)] first:border-t-0"
      >
        {dish.imageUrl ? (
          <div className="relative h-20 w-20 md:h-24 md:w-24 overflow-hidden rounded-sm shrink-0 bg-[var(--color-card)]">
            <Image
              src={dish.imageUrl}
              alt={dish.name}
              fill
              sizes="96px"
              className="object-cover transition-transform duration-1000 group-hover/row:scale-110"
            />
          </div>
        ) : (
          <div className="h-20 w-20 md:h-24 md:w-24 shrink-0 rounded-sm border border-[var(--color-border)]" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-4 justify-between">
            <div className="min-w-0">
              <h3 className="font-bold text-2xl md:text-[28px] text-[var(--color-foreground)] leading-tight tracking-[-0.03em]">
                {dish.name}
              </h3>
              {dish.nameFa && (
                <p className="text-[var(--color-foreground)]/45 text-sm mt-1 font-light">
                  {dish.nameFa}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-lg md:text-xl text-terracotta tabular-nums">
                {formatPrice(dish.price, dish.currency)}
              </p>
            </div>
          </div>
          {dish.description && (
            <p className="mt-3 text-[var(--color-foreground)]/65 text-[14px] md:text-[15px] leading-[1.55] line-clamp-2 max-w-2xl font-light">
              {dish.description}
            </p>
          )}
          <DishBadges dish={dish} className="mt-4" />
        </div>
      </motion.button>
    );
  }

  if (layout === "feature") {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="group/feat block w-full text-left"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-[var(--color-card)] rounded-sm">
          {dish.imageUrl && (
            <Image
              src={dish.imageUrl}
              alt={dish.name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-[1500ms] ease-out group-hover/feat:scale-[1.04]"
            />
          )}
        </div>
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-foreground)]/50">
              {dish.category.name}
            </p>
            <h3 className="mt-2 font-bold text-2xl md:text-3xl text-[var(--color-foreground)] tracking-[-0.03em] leading-tight">
              {dish.name}
            </h3>
          </div>
          <span className="font-bold text-base md:text-lg text-terracotta tabular-nums shrink-0 mt-1">
            {formatPrice(dish.price, dish.currency)}
          </span>
        </div>
      </motion.button>
    );
  }

  // card (default)
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="group/card block w-full text-left"
    >
      <div className="relative overflow-hidden rounded-sm bg-[var(--color-card)] aspect-[4/5]">
        {dish.imageUrl ? (
          <Image
            src={dish.imageUrl}
            alt={dish.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={cn(
              "object-cover transition-transform duration-[1200ms] ease-out group-hover/card:scale-[1.05]",
              !dish.isAvailable && "grayscale opacity-50",
            )}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[var(--color-foreground)]/15">
            <span className="font-bold text-6xl">{dish.name[0]}</span>
          </div>
        )}
        {!dish.isAvailable && (
          <div className="absolute top-4 left-4">
            <Badge variant="outline" className="bg-warm-white/85">
              Sold out
            </Badge>
          </div>
        )}
        {dish.isSignature && (
          <div className="absolute top-4 right-4">
            <Badge variant="terracotta">Signature</Badge>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-bold text-lg md:text-xl text-[var(--color-foreground)] tracking-[-0.025em] leading-tight">
            {dish.name}
          </h3>
          {dish.nameFa && (
            <p className="mt-1 text-[var(--color-foreground)]/45 text-xs font-light">
              {dish.nameFa}
            </p>
          )}
        </div>
        <span className="font-bold text-sm md:text-base text-terracotta tabular-nums shrink-0 mt-1">
          {formatPrice(dish.price, dish.currency)}
        </span>
      </div>
      {dish.description && (
        <p className="mt-2 text-[13px] font-light text-[var(--color-foreground)]/55 leading-[1.55] line-clamp-2">
          {dish.description}
        </p>
      )}
      <DishBadges dish={dish} className="mt-3" hideSignature />
    </motion.button>
  );
}

function DishBadges({
  dish,
  className,
  hideSignature,
}: {
  dish: DishCardData;
  className?: string;
  hideSignature?: boolean;
}) {
  const items: React.ReactNode[] = [];
  if (dish.isSignature && !hideSignature)
    items.push(
      <Badge key="sig" variant="signature">
        <Sparkles className="h-2.5 w-2.5" strokeWidth={1.6} />
        Signature
      </Badge>,
    );
  if (dish.isBestseller && !dish.isSignature)
    items.push(<Badge key="best" variant="default">Bestseller</Badge>);
  if (dish.isNew) items.push(<Badge key="new" variant="new">New</Badge>);
  if (dish.isVegetarian)
    items.push(
      <Badge key="veg" variant="veg">
        <Leaf className="h-2.5 w-2.5" strokeWidth={1.6} /> Veg
      </Badge>,
    );
  if (dish.spicyLevel > 0)
    items.push(
      <Badge key="spi" variant="spicy">
        <Flame className="h-2.5 w-2.5" strokeWidth={1.6} />
        {dish.spicyLevel >= 3
          ? "Hot"
          : dish.spicyLevel >= 2
            ? "Medium"
            : "Mild"}
      </Badge>,
    );
  if (items.length === 0) return null;
  return <div className={cn("flex flex-wrap gap-1.5", className)}>{items}</div>;
}
