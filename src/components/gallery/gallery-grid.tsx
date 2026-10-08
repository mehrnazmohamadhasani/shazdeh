"use client";
import * as React from "react";
import Image from "next/image";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { EASE } from "@/lib/motion";

export type GalleryImage = {
  id: string;
  imageUrl: string;
};

/*
 * Editorial gallery — a calm, uniform 4:5 grid on warm white so every
 * photograph carries the same weight. The lightbox flips to the
 * black ground (the brand's "dark" photography style) and is a real
 * modal: focus is trapped, Escape closes, arrow keys navigate.
 */

function altFor(i: number) {
  return `A SHĀZDEH plate, photograph ${i + 1}`;
}

export function GalleryGrid({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = React.useState<number | null>(null);
  const count = images.length;

  const go = React.useCallback(
    (delta: number) =>
      setActive((i) => (i === null ? null : (i + delta + count) % count)),
    [count],
  );

  if (count === 0) {
    return (
      <div className="container-shazdeh pb-32">
        <p className="t-h3">New photographs are on their way.</p>
        <p className="t-body mt-3 text-dark-grey">
          Follow the kitchen on Instagram for today&apos;s plates.
        </p>
      </div>
    );
  }

  const current = active === null ? null : images[active];

  return (
    <>
      <ul className="container-shazdeh grid grid-cols-2 gap-x-3 gap-y-8 pb-28 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-12">
        {images.map((img, i) => (
          <motion.li
            key={img.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.8, delay: (i % 3) * 0.06, ease: EASE }}
          >
            <button
              type="button"
              onClick={() => setActive(i)}
              className="group block w-full text-left"
              aria-label={`Open photograph: ${altFor(i)}`}
            >
              <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-sm bg-cream">
                <Image
                  src={img.imageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 30vw, 48vw"
                  className="img-zoom object-cover"
                />
              </span>
            </button>
          </motion.li>
        ))}
      </ul>

      <DialogPrimitive.Root
        open={active !== null}
        onOpenChange={(o) => !o && setActive(null)}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="overlay-anim fixed inset-0 z-50 bg-black-iron/[0.96]" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") go(-1);
              if (e.key === "ArrowRight") go(1);
            }}
            className="overlay-anim fixed inset-0 z-50 flex flex-col pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)] pt-[var(--safe-top)] text-warm-white focus:outline-none"
          >
            <div className="flex items-center justify-between px-5 py-4 md:px-8">
              <DialogPrimitive.Title className="text-[11px] font-medium uppercase tracking-[0.22em] text-warm-white/75">
                {active !== null && (
                  <>
                    <span className="tabular-nums">
                      {String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
                    </span>
                  </>
                )}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Close gallery"
                className="grid h-11 w-11 place-items-center rounded-full bg-warm-white/10 transition-colors hover:bg-warm-white/20"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </DialogPrimitive.Close>
            </div>

            <div className="relative flex-1">
              <AnimatePresence mode="wait" initial={false}>
                {current && active !== null && (
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="absolute inset-x-4 inset-y-2 md:inset-x-24"
                  >
                    <Image
                      src={current.imageUrl}
                      alt={altFor(active)}
                      fill
                      sizes="100vw"
                      className="object-contain"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {count > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="Previous photograph"
                    className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-warm-white/10 transition-colors hover:bg-warm-white/20 md:left-6"
                  >
                    <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="Next photograph"
                    className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-warm-white/10 transition-colors hover:bg-warm-white/20 md:right-6"
                  >
                    <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                </>
              )}
            </div>

            <div className="h-16" aria-hidden />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
