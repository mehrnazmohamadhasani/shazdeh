"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { EASE } from "@/lib/motion";

/*
 * Home hero — full-bleed photograph of the SHĀZDEH Mix with the brand
 * line set large. The image is the LCP element, so it is preloaded and
 * served responsively; a dark base keeps the headline legible while it
 * loads.
 */

const HERO_IMAGE = "/menu/shazdeh-mix.jpg";

export function HomeHero({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string | null;
}) {
  const sectionRef = React.useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);
  const fade = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  return (
    <section
      ref={sectionRef}
      aria-label="Introduction"
      className="relative h-[100svh] min-h-[620px] w-full overflow-hidden bg-[#2a1d16] text-warm-white"
    >
      <motion.div style={{ y, scale }} className="absolute inset-0 will-change-transform">
        <Image
          src={HERO_IMAGE}
          alt="SHĀZDEH Mix — three saffron rice crowns filled with khoresh"
          fill
          preload
          sizes="100vw"
          className="object-cover object-[50%_58%] brightness-[1.05] saturate-[1.05]"
        />
        {/* Warm luminous wash at the top */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_10%,rgba(253,246,236,0.28),transparent_60%)]"
        />
        {/* Nav legibility */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black-iron/35 to-transparent"
        />
        {/* Type legibility — strong enough for AA on any frame */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black-iron/75 via-black-iron/30 to-transparent"
        />
      </motion.div>

      <motion.div
        style={{ opacity: fade }}
        className="relative z-10 flex h-full flex-col justify-end pb-24 sm:pb-28 md:pb-32"
      >
        <div className="container-shazdeh">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="text-center text-[11px] font-medium uppercase tracking-[0.3em] text-warm-white/85 sm:text-left"
          >
            Persian Cuisine · Dubai
          </motion.p>

          <h1 className="t-display mx-auto mt-5 max-w-[13ch] animate-rise text-center [animation-delay:120ms] max-sm:text-[13vw] sm:mx-0 sm:max-w-[14ch] sm:text-left">
            {title ? (
              title
            ) : (
              <>
                From our heart to your <span className="text-apricot-clay">home</span>.
              </>
            )}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
            className="t-lead mx-auto mt-6 max-w-md text-center text-warm-white/85 sm:mx-0 sm:text-left"
          >
            {subtitle ??
              "Contemporary Persian cuisine — slow-cooked, saffron-bright, and delivered across Dubai."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.6, ease: EASE }}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              href="/order"
              className="inline-flex h-14 items-center justify-center rounded-pill bg-terracotta px-9 text-[12px] font-medium uppercase tracking-[0.22em] text-white glow-terracotta hover:bg-terracotta-ink"
            >
              Order now
            </Link>
            <Link
              href="/menu"
              className="inline-flex h-14 items-center justify-center rounded-pill border border-warm-white/50 px-9 text-[12px] font-medium uppercase tracking-[0.22em] text-warm-white transition-colors duration-500 hover:border-warm-white hover:bg-warm-white/10"
            >
              Explore the menu
            </Link>
          </motion.div>
        </div>
      </motion.div>

    </section>
  );
}
