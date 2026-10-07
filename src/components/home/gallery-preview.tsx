"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { SectionHeading } from "@/components/shared/section-heading";
import { Reveal } from "@/components/shared/reveal";

export type GalleryPreviewImage = { id: string; url: string; alt: string };

/*
 * Gallery preview — desktop: a scroll-linked horizontal strip of
 * uniform 4:5 photographs. Phones: a compact two-column mosaic (no
 * sideways scroll-jacking, and no endless vertical stack).
 */
export function GalleryPreview({ images }: { images: GalleryPreviewImage[] }) {
  const ref = React.useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const x = useTransform(scrollYProgress, [0, 1], ["4%", "-18%"]);

  if (images.length === 0) return null;

  return (
    <section
      ref={ref}
      aria-labelledby="gallery-heading"
      className="section overflow-hidden"
    >
      <div className="container-shazdeh">
        <SectionHeading
          id="gallery-heading"
          eyebrow="Gallery"
          title="A closer look at the table."
          link={{ href: "/gallery", label: "Open the gallery" }}
        />
      </div>

      {/* Phones — mosaic */}
      <div className="container-shazdeh mt-12 grid grid-cols-2 gap-3 md:hidden">
        {images.slice(0, 4).map((img, i) => (
          <Reveal key={img.id} delay={i * 0.05}>
            <Link
              href="/gallery"
              tabIndex={-1}
              aria-hidden
              className="relative block aspect-[3/4] overflow-hidden rounded-sm bg-cream"
            >
              <Image src={img.url} alt="" fill sizes="45vw" className="object-cover" />
            </Link>
          </Reveal>
        ))}
      </div>

      {/* Tablet & desktop — scroll-linked strip */}
      <div className="mt-20 hidden md:block">
        <motion.ul
          style={{ x }}
          className="flex gap-8 pl-12 will-change-transform lg:gap-10 lg:pl-20"
        >
          {images.slice(0, 8).map((img) => (
            <li
              key={img.id}
              className="relative aspect-[4/5] w-[340px] shrink-0 overflow-hidden rounded-sm bg-cream lg:w-[380px]"
            >
              <Image
                src={img.url}
                alt={img.alt}
                fill
                sizes="380px"
                className="object-cover"
              />
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
