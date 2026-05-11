"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { Reveal } from "@/components/shared/reveal";

/*
 * Closing CTA — invitation to reserve / order. Light warm-white
 * ground with a faint food image at low opacity. Layout unchanged.
 */
export function HomeCta({
  imageUrl,
  whatsapp,
}: {
  imageUrl?: string;
  whatsapp?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["8%", "-8%"]);

  const waUrl = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        "Hello SHĀZDEH — I'd like to reserve a table.",
      )}`
    : undefined;

  return (
    <section
      ref={ref}
      className="relative bg-warm-white text-black-iron overflow-hidden"
    >
      {imageUrl && (
        <motion.div
          style={{ y }}
          className="absolute inset-0 will-change-transform"
        >
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover scale-110 opacity-10"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-warm-white via-warm-white/80 to-warm-white" />
        </motion.div>
      )}

      <div className="container-shazdeh relative z-10 py-28 md:py-44 lg:py-56">
        <Reveal>
          <p className="eyebrow">Reserve</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="mt-6 font-bold text-5xl md:text-7xl lg:text-[7rem] leading-[0.94] tracking-[-0.05em] max-w-5xl">
            A seat at the
            <br />
            <span className="text-terracotta">Persian table.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.18}>
          <p className="mt-10 max-w-md text-[15px] md:text-[17px] font-light text-black-iron/60 leading-[1.6]">
            For private dinners, family gatherings or quiet weeknights —
            we set the table with the same intention.
          </p>
        </Reveal>
        <Reveal delay={0.28}>
          <div className="mt-12 flex flex-col sm:flex-row gap-3 sm:items-center">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-14 px-9 rounded-pill bg-terracotta text-warm-white text-[12px] tracking-[0.22em] uppercase font-medium glow-terracotta transition-all duration-500 hover:bg-[oklch(from_#ce4927_calc(l-0.04)_c_h)]"
              >
                Reserve on WhatsApp
              </a>
            )}
            <Link
              href="/contact"
              className="inline-flex items-center justify-center h-14 px-9 rounded-pill border border-black-iron/25 text-black-iron text-[12px] tracking-[0.22em] uppercase font-medium hover:border-terracotta hover:text-terracotta transition-all duration-500"
            >
              All ways to reach us
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
