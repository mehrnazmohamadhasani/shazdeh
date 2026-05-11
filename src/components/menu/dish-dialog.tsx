"use client";
import * as React from "react";
import Image from "next/image";
import { Sparkles, Leaf, Flame } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WhatsappIcon } from "@/components/icons/social";
import { formatPrice } from "@/lib/utils";
import type { DishCardData } from "./dish-card";

export function DishDialog({
  open,
  onOpenChange,
  dish,
  whatsapp,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dish: DishCardData | null;
  whatsapp?: string;
}) {
  if (!dish) return null;

  const orderUrl = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hello SHĀZDEH — I'd like to order: ${dish.name}`,
      )}`
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-3xl overflow-hidden bg-warm-white text-black-iron">
        {dish.imageUrl && (
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-cream">
            <Image
              src={dish.imageUrl}
              alt={dish.name}
              fill
              sizes="(min-width: 768px) 768px, 100vw"
              className="object-cover"
            />
            <div className="absolute bottom-5 left-6 flex flex-wrap gap-1.5">
              {dish.isSignature && (
                <Badge variant="terracotta">
                  <Sparkles className="h-2.5 w-2.5" strokeWidth={1.6} />
                  Signature
                </Badge>
              )}
              {dish.isBestseller && !dish.isSignature && (
                <Badge variant="default" className="bg-warm-white/90">
                  Bestseller
                </Badge>
              )}
              {dish.isNew && <Badge variant="new">New</Badge>}
              {dish.isVegetarian && (
                <Badge variant="veg">
                  <Leaf className="h-2.5 w-2.5" strokeWidth={1.6} /> Veg
                </Badge>
              )}
              {dish.spicyLevel > 0 && (
                <Badge variant="spicy">
                  <Flame className="h-2.5 w-2.5" strokeWidth={1.6} />
                  {dish.spicyLevel >= 3
                    ? "Hot"
                    : dish.spicyLevel >= 2
                      ? "Medium"
                      : "Mild"}
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="p-7 md:p-10">
          <p className="text-[10px] tracking-[0.22em] uppercase text-black-iron/55">
            {dish.category.name}
          </p>
          <DialogTitle className="mt-3">{dish.name}</DialogTitle>
          {dish.nameFa && (
            <p className="mt-2 text-dark-grey text-base font-light">
              {dish.nameFa}
            </p>
          )}

          {dish.description && (
            <DialogDescription className="mt-6">
              {dish.description}
            </DialogDescription>
          )}

          <Separator className="my-7 bg-black-iron/10" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <p className="text-[10px] tracking-[0.22em] uppercase text-black-iron/55">
                Price
              </p>
              <p className="mt-2 font-bold text-3xl md:text-4xl text-terracotta tabular-nums tracking-[-0.03em]">
                {formatPrice(dish.price, dish.currency)}
              </p>
            </div>

            {orderUrl && (
              <Button asChild size="lg" className="sm:w-auto">
                <a href={orderUrl} target="_blank" rel="noopener noreferrer">
                  <WhatsappIcon className="h-4 w-4" />
                  Order on WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
