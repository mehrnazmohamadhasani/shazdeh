"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { ArchLines } from "@/components/brand/arch";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/*
 * SHĀZDEH navigation.
 *
 * Transparent over the home video, settling onto a frosted warm-white
 * bar on scroll (desktop) or the brand terracotta bar (mobile, per the
 * guidelines' mobile header). "Order" is the single primary action —
 * SHĀZDEH is delivery-only, so ordering is the conversion that matters.
 */

const NAV_LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "Story" },
  { href: "/gallery", label: "Gallery" },
] as const;

function subscribeScroll(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
}

function useScrolled(threshold = 24) {
  return React.useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > threshold,
    () => false,
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();
  const scrolled = useScrolled();
  const [open, setOpen] = React.useState(false);

  // Only the home page opens on a full-bleed video.
  const overMedia = pathname === "/" && !scrolled;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b pt-[var(--safe-top)] transition-[background-color,border-color,color,backdrop-filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
        overMedia
          ? "border-transparent bg-transparent text-warm-white"
          : scrolled
            ? "border-black-iron/[0.07] max-md:border-transparent max-md:bg-terracotta max-md:text-white md:glass-soft md:text-black-iron"
            : "border-transparent bg-transparent text-black-iron",
      )}
    >
      <div className="container-shazdeh flex h-[68px] items-center justify-between md:h-[84px]">
        <Link
          href="/"
          aria-label="SHĀZDEH — home"
          className="relative -my-2 py-2 transition-opacity duration-300 hover:opacity-75"
        >
          <Wordmark size="md" logoUrl={logoUrl} />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-11 md:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-2 text-[11px] font-medium uppercase tracking-[0.22em] transition-opacity duration-300",
                  active ? "opacity-100" : "opacity-70 hover:opacity-100",
                )}
              >
                {link.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-0 bottom-0 h-px bg-current"
                    transition={{ duration: 0.6, ease: EASE }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/order"
            className={cn(
              "hidden h-11 items-center rounded-pill px-6 text-[11px] font-medium uppercase tracking-[0.22em] transition-all duration-500 md:inline-flex",
              overMedia
                ? "bg-warm-white text-black-iron hover:bg-white"
                : "bg-terracotta text-white glow-terracotta hover:bg-terracotta-ink",
            )}
          >
            Order now
          </Link>

          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger
              aria-label="Open menu"
              className={cn(
                // The installed app navigates from its bottom tab bar instead.
                "grid h-11 w-11 place-items-center rounded-full border transition-colors md:hidden standalone:hidden",
                overMedia || scrolled
                  ? "border-white/40 hover:bg-white/10"
                  : "border-black-iron/20 hover:bg-black-iron/[0.04]",
              )}
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </DialogPrimitive.Trigger>

            <DialogPrimitive.Portal>
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className="sheet-anim fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-warm-white pb-[var(--safe-bottom)] pt-[var(--safe-top)] text-black-iron md:hidden"
              >
                <DialogPrimitive.Title className="sr-only">
                  Site menu
                </DialogPrimitive.Title>

                <ArchLines
                  count={2}
                  className="absolute -bottom-10 left-1/2 h-[62vh] w-[78vw] -translate-x-1/2 text-terracotta/20"
                />

                <div className="container-shazdeh flex h-[68px] shrink-0 items-center justify-between">
                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    aria-label="SHĀZDEH — home"
                  >
                    <Wordmark size="md" logoUrl={logoUrl} />
                  </Link>
                  <DialogPrimitive.Close
                    aria-label="Close menu"
                    className="grid h-11 w-11 place-items-center rounded-full border border-black-iron/20 transition-colors hover:bg-black-iron/[0.04]"
                  >
                    <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  </DialogPrimitive.Close>
                </div>

                <nav
                  aria-label="Primary"
                  className="container-shazdeh relative mt-10 flex flex-col"
                >
                  {[{ href: "/", label: "Home" }, ...NAV_LINKS, { href: "/order", label: "Order" }].map(
                    (link, i) => {
                      const active =
                        link.href === "/"
                          ? pathname === "/"
                          : isActive(pathname, link.href);
                      return (
                        <motion.div
                          key={link.href}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.08 + i * 0.06, duration: 0.6, ease: EASE }}
                        >
                          <Link
                            href={link.href}
                            onClick={() => setOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex items-baseline justify-between border-b border-black-iron/[0.08] py-4 text-[2.5rem] font-bold leading-none tracking-[-0.04em]",
                              active ? "text-terracotta-ink" : "text-black-iron",
                            )}
                          >
                            {link.label}
                            <span className="text-[11px] font-medium tracking-[0.2em] text-dark-grey tabular-nums">
                              0{i + 1}
                            </span>
                          </Link>
                        </motion.div>
                      );
                    },
                  )}
                </nav>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6, ease: EASE }}
                  className="container-shazdeh relative mt-auto pb-10 pt-12"
                >
                  <Link
                    href="/order"
                    onClick={() => setOpen(false)}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-terracotta text-[12px] font-medium uppercase tracking-[0.22em] text-white"
                  >
                    Order delivery
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
                  </Link>
                  <p className="mt-6 text-center text-[10.5px] uppercase tracking-[0.3em] text-dark-grey">
                    Persian Cuisine · Dubai
                  </p>
                </motion.div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </div>
      </div>
    </header>
  );
}
