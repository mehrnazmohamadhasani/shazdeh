"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";

/*
 * Gallery preview — a horizontal scroll-driven track. As the user
 * scrolls the section, the strip of editorial photography drifts
 * sideways. Set on warm white per the Light style.
 */
export function GalleryPreview({
  images,
}: {
  images: { id: string; url: string; alt: string; title?: string | null }[];
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const x = useTransform(scrollYProgress, [0, 1], ["8%", "-22%"]);

  if (images.length === 0) return null;

  return (
    <section
      ref={ref}
      className="relative bg-warm-white text-black-iron py-28 md:py-44 overflow-hidden"
    >
      <div className="container-shazdeh">
        <div className="grid grid-cols-12 gap-y-8 lg:gap-x-10 items-end">
          <div className="col-span-12 lg:col-span-8">
            <Reveal>
              <p className="eyebrow eyebrow-accent">Gallery</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-6 font-bold text-5xl md:text-7xl lg:text-[6rem] leading-[0.94] tracking-[-0.045em] max-w-3xl">
                A closer look at the table.
              </h2>
            </Reveal>
          </div>
          <div className="col-span-12 lg:col-span-4 lg:text-right">
            <Reveal delay={0.18}>
              <Link
                href="/gallery"
                className="inline-flex items-center gap-3 text-[11px] tracking-[0.22em] uppercase font-medium text-black-iron group"
              >
                <span className="border-b border-black-iron/40 group-hover:border-terracotta group-hover:text-terracotta transition-colors pb-1">
                  Open gallery
                </span>
                <ArrowUpRight
                  className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-terracotta"
                  strokeWidth={1.5}
                />
              </Link>
            </Reveal>
          </div>
        </div>
      </div>

      <div className="mt-20 overflow-hidden">
        <motion.div
          style={{ x }}
          className="flex gap-6 md:gap-10 will-change-transform pl-6 md:pl-12 lg:pl-20"
        >
          {images.slice(0, 8).map((img, i) => (
            <div
              key={img.id}
              className={`relative shrink-0 overflow-hidden rounded-sm bg-cream ${
                i % 3 === 0
                  ? "h-[520px] w-[380px]"
                  : i % 3 === 1
                    ? "h-[440px] w-[440px]"
                    : "h-[480px] w-[340px]"
              }`}
            >
              <Image
                src={img.url}
                alt={img.alt}
                fill
                sizes="(min-width: 768px) 440px, 340px"
                className="object-cover"
              />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
