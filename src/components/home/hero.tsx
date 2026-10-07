"use client";
import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { Pause, Play } from "lucide-react";
import { EASE } from "@/lib/motion";

/*
 * Home hero — full-bleed film of the kitchen with the brand line set
 * large. Mobile crops toward the dish and lets the type fill the frame.
 *
 *   – A dark base + poster frame keep the headline legible before the
 *     video arrives (slow networks, Save-Data, Low Power Mode).
 *   – Reduced-motion visitors get the still frame, and everyone gets a
 *     pause control (WCAG 2.2.2 for auto-playing media).
 */

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3KMJxreDoLWfE2avXYNCuzD8geX/hf_20261007_121509_a24fd74c-b626-400d-bcba-4023a46c2dff.mp4";
const HERO_POSTER = "/menu/shazdeh-mix.jpg";

export function HomeHero({
  title,
  subtitle,
  videoSrc,
}: {
  title?: string;
  subtitle?: string | null;
  videoSrc?: string | null;
}) {
  const sectionRef = React.useRef<HTMLElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = React.useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);
  const fade = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  // Respect reduced motion: hold the poster frame instead of playing.
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) videoRef.current?.pause();
  }, []);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Introduction"
      className="relative h-[100svh] min-h-[620px] w-full overflow-hidden bg-[#2a1d16] text-warm-white"
    >
      <motion.div style={{ y, scale }} className="absolute inset-0 will-change-transform">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={HERO_POSTER}
          aria-hidden
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          className="absolute inset-0 h-full w-full origin-center scale-[1.38] object-cover object-[72%_52%] brightness-[1.1] saturate-[1.08] sm:scale-100 sm:object-center"
        >
          <source src={videoSrc || HERO_VIDEO} type="video/mp4" />
        </video>
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

      <button
        type="button"
        onClick={toggle}
        aria-label={paused ? "Play background video" : "Pause background video"}
        className="absolute bottom-6 right-5 z-20 grid h-11 w-11 place-items-center rounded-full border border-warm-white/35 text-warm-white/85 backdrop-blur-sm transition-colors hover:bg-warm-white/10 sm:right-8 md:bottom-8"
      >
        {paused ? (
          <Play className="h-4 w-4" strokeWidth={1.5} />
        ) : (
          <Pause className="h-4 w-4" strokeWidth={1.5} />
        )}
      </button>
    </section>
  );
}
