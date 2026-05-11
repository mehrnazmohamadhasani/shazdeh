"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { DishCardData } from "@/components/menu/dish-card";
import { DishCard } from "@/components/menu/dish-card";
import { DishDialog } from "@/components/menu/dish-dialog";
import { Reveal } from "@/components/shared/reveal";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/*
 * Popular dishes — four customer favourites in an equal 4-up grid
 * on a Cream ground. No hierarchy, no hero card — every dish gets
 * the same quiet editorial weight.
 */
export function FeaturedDishes({
  dishes,
  whatsapp,
}: {
  dishes: DishCardData[];
  whatsapp?: string;
}) {
  const [active, setActive] = React.useState<DishCardData | null>(null);

  return (
    <section
      data-theme="cream"
      className="relative bg-cream text-black-iron py-28 md:py-44"
    >
      <div className="container-shazdeh">
        <div className="grid grid-cols-12 gap-y-10 lg:gap-x-10 items-end">
          <div className="col-span-12 lg:col-span-8">
            <Reveal>
              <p className="eyebrow eyebrow-accent">Most Loved</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-6 font-bold text-5xl md:text-7xl lg:text-[6rem] leading-[0.94] tracking-[-0.045em]">
                The dishes our
                <br />
                <span className="text-terracotta">guests keep ordering</span>.
              </h2>
            </Reveal>
          </div>
          <div className="col-span-12 lg:col-span-4 lg:text-right">
            <Reveal delay={0.18}>
              <Link
                href="/menu"
                className="inline-flex items-center gap-3 text-[11px] tracking-[0.22em] uppercase font-medium text-black-iron group"
              >
                <span className="border-b border-black-iron/40 group-hover:border-terracotta group-hover:text-terracotta transition-colors pb-1">
                  Full menu
                </span>
                <ArrowUpRight
                  className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-terracotta"
                  strokeWidth={1.5}
                />
              </Link>
            </Reveal>
          </div>
        </div>

        {dishes.length > 0 && (
          <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 md:gap-x-8 gap-y-14">
            {dishes.map((dish, i) => (
              <motion.div
                key={dish.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{
                  duration: 1.0,
                  delay: 0.04 + i * 0.08,
                  ease: EASE,
                }}
              >
                <DishCard
                  dish={dish}
                  layout="feature"
                  onClick={() => setActive(dish)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <DishDialog
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
        dish={active}
        whatsapp={whatsapp}
      />
    </section>
  );
}
