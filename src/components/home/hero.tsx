"use client";
import * as React from "react";
import { getImageProps } from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { EASE } from "@/lib/motion";

/*
 * Home hero — full-bleed photograph of the SHĀZDEH Mix with the brand
 * line set large. The image is the LCP element, so it is fetched with
 * high priority and served responsively; a dark base keeps the headline
 * legible while it loads. Phones get a portrait photo instead (art
 * direction), with a muted looping video playing over it.
 */

const HERO_IMAGE = "/menu/shazdeh-mix.jpg";
const HERO_IMAGE_MOBILE = "/brand/hero-mobile.jpg";
const HERO_VIDEO_MOBILE = "/brand/hero-mobile.mp4";
const HERO_VIDEO_MOBILE_POSTER = "/brand/hero-mobile-poster.jpg";

/* Phone widths only (below Tailwind `sm`), and never for reduced motion —
 * so desktop never downloads the clip. */
const MOBILE_VIDEO_QUERY =
  "(max-width: 639px) and (prefers-reduced-motion: no-preference)";

function useMobileVideo() {
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(MOBILE_VIDEO_QUERY);
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return enabled;
}

const HERO_IMAGE_COMMON = {
  alt: "Saffron rice from the SHĀZDEH kitchen, crowned with khoresh, barberries and pistachio",
  fill: true,
  sizes: "100vw",
  fetchPriority: "high",
  loading: "eager",
} as const;
const {
  props: { srcSet: heroDesktopSrcSet },
} = getImageProps({ ...HERO_IMAGE_COMMON, src: HERO_IMAGE });
const {
  props: { srcSet: heroMobileSrcSet, ...heroImgProps },
} = getImageProps({ ...HERO_IMAGE_COMMON, src: HERO_IMAGE_MOBILE });

export function HomeHero({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string | null;
}) {
  const sectionRef = React.useRef<HTMLElement>(null);
  const showVideo = useMobileVideo();

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
        <picture>
          <source media="(min-width: 640px)" srcSet={heroDesktopSrcSet} />
          <source srcSet={heroMobileSrcSet} />
          {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
          <img
            {...heroImgProps}
            className="object-cover sm:object-[50%_58%] sm:brightness-[1.05] sm:saturate-[1.05]"
          />
        </picture>
        {/* Mobile: looping video over the photo, which stays as the fallback */}
        {showVideo && (
          <video
            aria-hidden
            src={HERO_VIDEO_MOBILE}
            poster={HERO_VIDEO_MOBILE_POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
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
          {/* Mobile: video and buttons only; the h1 stays for screen readers */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="text-left text-[11px] font-medium uppercase tracking-[0.3em] text-warm-white/85 max-sm:hidden"
          >
            Persian Cuisine · Dubai
          </motion.p>

          <h1 className="t-display mt-5 max-w-[14ch] animate-rise text-left [animation-delay:120ms] max-sm:sr-only">
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
            className="t-lead mt-6 max-w-md text-left text-warm-white/85 max-sm:hidden"
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
