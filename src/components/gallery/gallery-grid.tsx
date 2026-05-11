"use client";
import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Img = {
  id: string;
  imageUrl: string;
  title?: string | null;
  caption?: string | null;
};

/*
 * Editorial gallery — Light style. A masonry rhythm on warm-white
 * with hairline frames, captions appearing only as small tracked
 * numerals beneath each image (Aesop catalogue cadence).
 *
 * The lightbox flips to the cinematic Black Iron ground.
 */
function cleanTitle(t: string | null | undefined) {
  if (!t) return t;
  return t.replace(/\.[a-z]{2,5}$/i, "").replace(/-/g, " ").replace(/_/g, " ");
}

export function GalleryGrid({ images }: { images: Img[] }) {
  const [active, setActive] = React.useState<number | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (active === null) return;
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowLeft")
        setActive((i) =>
          i === null ? null : (i - 1 + images.length) % images.length,
        );
      if (e.key === "ArrowRight")
        setActive((i) => (i === null ? null : (i + 1) % images.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, images.length]);

  return (
    <>
      <div className="container-shazdeh pb-32">
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 md:gap-8 [&>*]:mb-6 md:[&>*]:mb-8">
          {images.map((img, i) => {
            const aspect = aspectFor(i);
            return (
              <motion.button
                key={img.id}
                onClick={() => setActive(i)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{
                  duration: 0.9,
                  delay: (i % 6) * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="group relative block w-full text-left"
              >
                <div
                  className={`relative w-full overflow-hidden rounded-sm bg-cream ${aspect}`}
                >
                  <Image
                    src={img.imageUrl}
                    alt={img.title ?? ""}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-[1500ms] ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <p className="text-[10px] tracking-[0.22em] uppercase text-black-iron/45">
                    {String(i + 1).padStart(2, "0")}
                    {img.title && (
                      <>
                        {" · "}
                        <span className="text-black-iron/70">{cleanTitle(img.title)}</span>
                      </>
                    )}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <Lightbox
        images={images}
        index={active}
        onClose={() => setActive(null)}
        onPrev={() =>
          setActive((i) =>
            i === null ? null : (i - 1 + images.length) % images.length,
          )
        }
        onNext={() =>
          setActive((i) => (i === null ? null : (i + 1) % images.length))
        }
      />
    </>
  );
}

function aspectFor(i: number) {
  const pattern = [
    "aspect-[4/5]",
    "aspect-[3/4]",
    "aspect-[1/1]",
    "aspect-[3/4]",
    "aspect-[4/5]",
    "aspect-[16/11]",
  ];
  return pattern[i % pattern.length];
}

function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: Img[];
  index: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <AnimatePresence>
      {index !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 bg-black-iron/95 backdrop-blur-xl grid place-items-center p-6 md:p-12"
          onClick={onClose}
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 grid place-items-center h-10 w-10 rounded-full bg-warm-white/10 text-warm-white hover:bg-warm-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 grid place-items-center h-12 w-12 rounded-full bg-warm-white/10 text-warm-white hover:bg-warm-white/20 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 grid place-items-center h-12 w-12 rounded-full bg-warm-white/10 text-warm-white hover:bg-warm-white/20 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <motion.div
            key={images[index].id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full h-full max-w-5xl max-h-[80vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[index].imageUrl}
              alt={images[index].title ?? ""}
              fill
              priority
              sizes="100vw"
              className="object-contain"
            />
          </motion.div>
          {images[index].title && (
            <div className="absolute bottom-6 left-0 right-0 text-center px-6">
              <p className="text-[10px] tracking-[0.32em] uppercase text-warm-white/70">
                {String(index + 1).padStart(2, "0")} ·{" "}
                {cleanTitle(images[index].title)}
              </p>
              {images[index].caption && (
                <p className="mt-2 text-warm-white/55 text-sm font-light">
                  {images[index].caption}
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
