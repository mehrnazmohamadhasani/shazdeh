"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowDown } from "lucide-react";

/*
 * Home hero — Light style. Warm-white background with full-bleed
 * food photography at reduced opacity, dark text on top. The parallax
 * and fade animations remain identical; only the colour palette flips.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function HomeHero({
  imageUrl,
  title,
  subtitle,
}: {
  imageUrl: string;
  title?: string;
  subtitle?: string | null;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 0.4, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);

  const hasCustomTitle = !!title;

  return (
    <section
      ref={ref}
      className="relative h-[100svh] min-h-[680px] w-full overflow-hidden bg-warm-white text-black-iron"
    >
      {/* Background image — Light style photography, warm overlay */}
      <motion.div
        style={{ y, scale }}
        className="absolute inset-0 will-change-transform"
      >
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-25"
        />
        {/* Warm-white gradient keeps text crisp at the bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-warm-white/20 via-warm-white/50 to-warm-white" />
      </motion.div>

      {/* Foreground content */}
      <motion.div
        style={{ opacity }}
        className="relative z-10 flex h-full flex-col"
      >
        {/* Top-of-page brand row */}
        <div className="container-shazdeh pt-28 md:pt-36">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
            className="text-[10px] tracking-[0.32em] uppercase text-black-iron/50"
          >
            Persian Cuisine · Dubai
          </motion.p>
        </div>

        {/* Main headline */}
        <div className="flex-1 container-shazdeh flex flex-col justify-end pb-20 md:pb-32">
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.45, ease: EASE }}
            className="font-bold text-[14vw] sm:text-[12vw] lg:text-[9vw] xl:text-[8.5rem] leading-[0.9] tracking-[-0.05em] max-w-6xl"
          >
            {hasCustomTitle ? (
              title
            ) : (
              <>
                <span className="block">From our</span>
                <span className="block">
                  <span className="text-terracotta">heart</span> to your
                </span>
                <span className="block">home.</span>
              </>
            )}
          </motion.h1>

          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, delay: 0.75, ease: EASE }}
              className="mt-10 max-w-md text-[15px] md:text-[17px] font-light text-black-iron/65 leading-[1.55]"
            >
              {subtitle}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, delay: 0.95, ease: EASE }}
            className="mt-12 flex flex-col sm:flex-row gap-3 sm:items-center"
          >
            <Link
              href="/menu"
              className="inline-flex items-center justify-center h-14 px-9 rounded-pill bg-terracotta text-warm-white text-[12px] tracking-[0.22em] uppercase font-medium glow-terracotta transition-all duration-500 hover:bg-[oklch(from_#ce4927_calc(l-0.04)_c_h)]"
            >
              View the menu
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center h-14 px-9 rounded-pill border border-black-iron/25 text-black-iron text-[12px] tracking-[0.22em] uppercase font-medium hover:border-terracotta hover:text-terracotta transition-all duration-500"
            >
              Our story
            </Link>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1.2 }}
          className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-black-iron/45"
        >
          <span className="text-[9px] tracking-[0.32em] uppercase">
            Scroll
          </span>
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <ArrowDown className="h-3 w-3" strokeWidth={1.5} />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
