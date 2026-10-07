"use client";
import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowDown } from "lucide-react";

/*
 * Home hero — Full-bleed video with mobile crop bias toward the dish,
 * and display-scale type that occupies the empty frame on small screens.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3KMJxreDoLWfE2avXYNCuzD8geX/hf_20261007_121509_a24fd74c-b626-400d-bcba-4023a46c2dff.mp4";

export function HomeHero({
  title,
  subtitle,
  videoSrc = HERO_VIDEO,
}: {
  title?: string;
  subtitle?: string | null;
  videoSrc?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const smoothScroll = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 28,
    mass: 0.35,
  });
  const y = useTransform(smoothScroll, [0, 1], ["0%", "16%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 0.4, 0]);
  const scale = useTransform(smoothScroll, [0, 1], [1, 1.1]);

  const hasCustomTitle = !!title;

  return (
    <section
      ref={ref}
      className="relative h-[100svh] min-h-[680px] w-full overflow-hidden bg-cream text-warm-white"
    >
      {/* Background video — mobile: zoom + bias toward dish (right/lower) */}
      <motion.div
        style={{ y, scale }}
        className="absolute inset-0 will-change-transform"
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          className="absolute inset-0 h-full w-full origin-center scale-[1.38] object-cover object-[72%_52%] brightness-[1.14] saturate-[1.1] contrast-[0.97] sm:scale-100 sm:object-center sm:brightness-[1.12] sm:saturate-[1.08]"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
        {/* Warm luminous wash */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_15%,rgba(253,246,236,0.42),transparent_62%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-warm-white/18 via-transparent to-transparent"
        />
        {/* Legibility at bottom only — keeps video bright above */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black-iron/48 via-black-iron/12 to-transparent sm:h-[52%] sm:from-black-iron/42"
        />
        {/* Nav readability without darkening the whole frame */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black-iron/25 to-transparent sm:h-28 sm:from-black-iron/18"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-warm-white/12 via-transparent to-transparent sm:hidden"
        />
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
            className="text-center text-[10px] tracking-[0.32em] uppercase text-warm-white/55 sm:text-left"
          >
            Persian Cuisine · Dubai
          </motion.p>
        </div>

        {/* Main headline — mobile: display type fills the open frame */}
        <div className="flex flex-1 flex-col container-shazdeh justify-center pb-24 pt-6 sm:justify-end sm:pb-32 sm:pt-0">
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.45, ease: EASE }}
            className="mx-auto w-full max-w-[16ch] text-center font-bold text-[12.5vw] leading-[0.92] tracking-[-0.045em] text-warm-white sm:mx-0 sm:max-w-3xl sm:text-left sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {hasCustomTitle ? (
              title
            ) : (
              <>
                From our{" "}
                <span className="text-terracotta">heart</span>
                <br className="sm:hidden" /> to your home.
              </>
            )}
          </motion.h1>

          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, delay: 0.75, ease: EASE }}
              className="mx-auto mt-6 max-w-md text-center text-[15px] font-light leading-[1.55] text-warm-white/70 sm:mx-0 sm:mt-8 sm:text-left md:text-[17px]"
            >
              {subtitle}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, delay: 0.95, ease: EASE }}
            className="mt-10 flex flex-col gap-3 sm:mt-12 sm:flex-row sm:items-center"
          >
            <Link
              href="/menu"
              className="inline-flex h-14 items-center justify-center rounded-pill bg-terracotta px-9 text-[12px] font-medium uppercase tracking-[0.22em] text-warm-white glow-terracotta transition-all duration-500 hover:bg-[oklch(from_#ce4927_calc(l-0.04)_c_h)]"
            >
              View the menu
            </Link>
            <Link
              href="/about"
              className="inline-flex h-14 items-center justify-center rounded-pill border border-warm-white/35 px-9 text-[12px] font-medium uppercase tracking-[0.22em] text-warm-white transition-all duration-500 hover:border-terracotta hover:text-terracotta"
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
          className="absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 text-warm-white/45"
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
