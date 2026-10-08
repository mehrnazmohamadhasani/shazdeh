"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WhatsappIcon } from "@/components/icons/social";
import { DishBadges, DishSubtitle } from "@/components/menu/dish-card";
import type { DishCardData } from "@/lib/dish";
import { whatsappHref } from "@/lib/links";
import { formatPrice } from "@/lib/utils";

/*
 * Dish detail — quick view from any dish card. Keeps the visitor in
 * the menu while giving them everything needed to order: the plate,
 * what's in it, allergens, price, and a one-tap WhatsApp order.
 */
export function DishDialog({
  dish,
  onOpenChange,
  whatsapp,
}: {
  dish: DishCardData | null;
  onOpenChange: (open: boolean) => void;
  whatsapp?: string;
}) {
  // Keep the last dish mounted while the close animation plays.
  const [shown, setShown] = React.useState(dish);
  if (dish && dish !== shown) setShown(dish);
  const d = dish ?? shown;

  if (!d) return null;

  const orderUrl = whatsappHref(
    whatsapp,
    `Hello SHĀZDEH — I'd like to order ${d.name}.`,
  );

  return (
    <Dialog open={!!dish} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px]">
        <div className="grid sm:grid-cols-2">
          <div className="relative aspect-[4/3] bg-cream sm:aspect-auto sm:min-h-[560px]">
            {d.imageUrl && (
              <Image
                src={d.imageUrl}
                alt={d.title}
                fill
                sizes="(min-width: 640px) 480px, 100vw"
                className="object-cover"
              />
            )}
          </div>

          <div className="flex flex-col p-7 pb-8 sm:p-10">
            <p className="eyebrow eyebrow-accent">{d.category.name}</p>
            <DialogTitle className="mt-4 text-[2rem] sm:text-[2.5rem]">
              {d.title}
            </DialogTitle>
            <DishSubtitle dish={d} className="mt-3 text-[15px]" />

            {d.description ? (
              <DialogDescription className="mt-6">
                {d.description}
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">
                {d.title} from the SHĀZDEH menu.
              </DialogDescription>
            )}

            <DishBadges dish={d} className="mt-6" />

            {(d.ingredients || d.allergens) && (
              <dl className="mt-7 space-y-4 border-t border-black-iron/10 pt-6 text-[14px]">
                {d.ingredients && (
                  <div>
                    <dt className="caption">Ingredients</dt>
                    <dd className="mt-1.5 leading-[1.6] text-black-iron/85">
                      {d.ingredients}
                    </dd>
                  </div>
                )}
                {d.allergens && (
                  <div>
                    <dt className="caption">Allergens</dt>
                    <dd className="mt-1.5 leading-[1.6] text-black-iron/85">
                      {d.allergens}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <div className="mt-auto pt-8">
              <div className="flex items-end justify-between gap-4 border-t border-black-iron/10 pt-6">
                <div>
                  <p className="caption">Price</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-[-0.03em] text-terracotta-ink">
                    {formatPrice(d.price)}
                  </p>
                </div>
                <Link
                  href={`/menu/${d.slug}`}
                  className="group inline-flex min-h-11 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-dark-grey hover:text-black-iron"
                >
                  <span className="link-underline">Dish page</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1"
                    strokeWidth={1.5}
                  />
                </Link>
              </div>

              {d.isAvailable ? (
                <div className="mt-6 flex flex-col gap-2.5">
                  <Button asChild size="lg">
                    <Link href={`/order?dish=${d.slug}`}>Order this dish</Link>
                  </Button>
                  {orderUrl && (
                    <Button asChild size="lg" variant="outline">
                      <a href={orderUrl} target="_blank" rel="noopener noreferrer">
                        <WhatsappIcon className="h-4 w-4" />
                        Ask on WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <p className="mt-6 rounded-sm bg-cream px-4 py-3 text-[14px] text-dark-grey">
                  This dish is sold out today — please check back tomorrow.
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
