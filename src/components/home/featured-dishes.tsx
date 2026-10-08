"use client";
import * as React from "react";
import type { DishCardData } from "@/lib/dish";
import { DishCard } from "@/components/menu/dish-card";
import { DishDialog } from "@/components/menu/dish-dialog";
import { RevealItem, RevealStagger } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";

/*
 * Featured dishes — arch-framed plates on a cream ground. Phones get
 * a snap carousel with a visible "peek" so the plates stay large; the
 * grid takes over from tablet up.
 */
export function FeaturedDishes({
  dishes,
  whatsapp,
}: {
  dishes: DishCardData[];
  whatsapp?: string;
}) {
  const [active, setActive] = React.useState<DishCardData | null>(null);

  if (dishes.length === 0) return null;

  return (
    <section
      data-theme="cream"
      aria-labelledby="signature-heading"
      className="section bg-cream"
    >
      <div className="container-shazdeh">
        <SectionHeading
          eyebrow="From the menu"
          id="signature-heading"
          title="The plates our guests return for."
          link={{ href: "/menu", label: "Full menu" }}
        />
      </div>

      <RevealStagger
        as="ul"
        className="no-scrollbar mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-2 sm:container-shazdeh sm:grid sm:snap-none sm:grid-cols-2 sm:gap-x-8 sm:gap-y-16 sm:overflow-visible md:mt-20 lg:grid-cols-4"
      >
        {dishes.map((dish, i) => (
          <RevealItem
            as="li"
            key={dish.id}
            className="w-[72vw] max-w-[320px] shrink-0 snap-center sm:w-auto sm:max-w-none"
          >
            <DishCard
              dish={dish}
              layout="feature"
              onSelect={setActive}
              imagePriority={i === 0}
            />
          </RevealItem>
        ))}
      </RevealStagger>

      <DishDialog
        dish={active}
        onOpenChange={(o) => !o && setActive(null)}
        whatsapp={whatsapp}
      />
    </section>
  );
}
