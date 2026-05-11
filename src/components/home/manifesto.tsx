"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";

/*
 * Manifesto / story preview — set on the warm-white editorial ground.
 * Two-column 12-grid: large editorial type left, full-bleed image
 * right with subtle parallax. Lots of negative space (Aesop).
 */
export function HomeManifesto() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["8%", "-8%"]);

  return (
    <section
      ref={ref}
      className="relative bg-warm-white text-black-iron py-28 md:py-44 lg:py-56"
    >
      <div className="container-shazdeh">
        <div className="grid grid-cols-12 gap-y-12 lg:gap-x-16">
          {/* Left — editorial copy */}
          <div className="col-span-12 lg:col-span-7 lg:pr-12">
            <Reveal>
              <p className="eyebrow eyebrow-accent">The Brand</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-8 font-bold text-5xl md:text-7xl lg:text-[6.5rem] leading-[0.94] tracking-[-0.045em]">
                Persian heritage,
                <br />
                <span className="text-terracotta">contemporary clarity</span>.
              </h2>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-12 max-w-xl space-y-6 font-light text-[16px] md:text-[18px] leading-[1.6] text-black-iron/75">
                <p>
                  SHĀZDEH is a contemporary Persian food brand rooted in
                  heritage and expressed through a modern visual language.
                </p>
                <p>
                  Inspired by Persian culture, craftsmanship, and
                  hospitality, we translate tradition into a refined,
                  accessible experience for today&apos;s urban lifestyle —
                  every plate balancing authenticity and simplicity.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.28}>
              <Link
                href="/about"
                className="mt-12 inline-flex items-center gap-3 text-[11px] tracking-[0.22em] uppercase font-medium text-black-iron group"
              >
                <span className="border-b border-black-iron/40 group-hover:border-terracotta group-hover:text-terracotta transition-colors pb-1">
                  Read the full story
                </span>
                <ArrowUpRight
                  className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-terracotta"
                  strokeWidth={1.5}
                />
              </Link>
            </Reveal>
          </div>

          {/* Right — Light style photography per brand book */}
          <div className="col-span-12 lg:col-span-5">
            <Reveal>
              <div className="relative aspect-[4/5] lg:aspect-[3/4] overflow-hidden bg-cream rounded-sm">
                <motion.div
                  style={{ y: imageY }}
                  className="absolute inset-0 will-change-transform"
                >
                  <Image
                    src="/menu/baghali-polo-mahiche.jpg"
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover scale-110"
                  />
                </motion.div>
              </div>
              <p className="mt-4 text-[10px] tracking-[0.22em] uppercase text-black-iron/45">
                01 — Baghali Polo ba Mahiche · Iranian saffron rice
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
