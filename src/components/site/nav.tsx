"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  motion,
  useScroll,
  useMotionValueEvent,
  AnimatePresence,
} from "motion/react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

/*
 * SHĀZDEH navigation.
 *
 * Per the brand book — minimal, floating, transparent over the hero,
 * elegantly transitioning to the warm-white surface on scroll. Inter
 * Medium, brand 6% tracking on labels, generous spacing.
 *
 * The `tone` prop lets pages override the at-rest tone (e.g. menu
 * pages without a dark hero start in light tone).
 */

const NAV_LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "Story" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteNav({
  tone: heroTone,
}: {
  /** Tone of the page area immediately under the navbar before scroll */
  tone?: "dark" | "light";
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 32));

  React.useEffect(() => setOpen(false), [pathname]);

  // All pages now open on the light warm-white tone.
  const initialTone = heroTone ?? "light";

  // Effective tone: when not scrolled we follow the hero; once
  // scrolled we always sit on warm-white (per the editorial system).
  const tone: "dark" | "light" = scrolled ? "light" : initialTone;

  return (
    <>
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
          scrolled
            ? "bg-warm-white/85 backdrop-blur-xl border-b border-black-iron/[0.06]"
            : "bg-transparent border-b border-transparent",
          tone === "light" ? "text-black-iron" : "text-warm-white",
        )}
      >
        <div className="container-shazdeh flex items-center justify-between h-[70px] md:h-[84px]">
          <Link
            href="/"
            className="relative z-10 transition-opacity hover:opacity-70"
            aria-label="SHĀZDEH home"
          >
            <Wordmark size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            {NAV_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative text-[11px] tracking-[0.22em] uppercase font-medium transition-opacity duration-300",
                    active
                      ? "opacity-100"
                      : "opacity-65 hover:opacity-100",
                  )}
                >
                  {link.label}
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute -bottom-2 left-0 right-0 h-px bg-terracotta"
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:block">
            <Link
              href="/contact"
              className={cn(
                "inline-flex items-center h-10 px-6 rounded-pill text-[11px] tracking-[0.22em] uppercase font-medium border transition-all duration-500",
                tone === "light"
                  ? "border-black-iron/30 hover:border-terracotta hover:text-terracotta"
                  : "border-warm-white/30 hover:border-terracotta hover:text-terracotta",
              )}
            >
              Order Online
            </Link>
          </div>

          <button
            className={cn(
              "md:hidden grid place-items-center h-10 w-10 rounded-full border transition-colors",
              tone === "light"
                ? "border-black-iron/15 hover:bg-black-iron/[0.04]"
                : "border-warm-white/15 hover:bg-warm-white/[0.06]",
            )}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Menu className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-40 md:hidden"
            style={{ backgroundColor: "#fdf6ec" }}
          >
            <div className="flex flex-col h-full pt-28 px-6">
              <nav className="flex flex-col">
                {NAV_LINKS.map((link, i) => {
                  const active = pathname.startsWith(link.href);
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.1 + i * 0.08,
                        duration: 0.7,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <Link
                        href={link.href}
                        className={cn(
                          "block py-5 font-bold text-5xl tracking-[-0.04em] border-b border-black-iron/[0.08]",
                          active ? "text-terracotta" : "text-black-iron",
                        )}
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.5,
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mt-auto pb-12"
              >
                <Link
                  href="/contact"
                  className="flex items-center justify-center h-14 w-full rounded-pill bg-terracotta text-warm-white text-[12px] tracking-[0.22em] uppercase font-medium"
                >
                  Order Online
                </Link>
                <p className="mt-6 text-center text-[10px] tracking-[0.32em] uppercase text-black-iron/50">
                  Persian Cuisine · Dubai
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
