"use client";
import * as React from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { ArchLines } from "@/components/brand/arch";
import { Reveal } from "@/components/shared/reveal";
import { TextLink } from "@/components/shared/section-heading";

/*
 * Story preview — the brand essence beside an arch-framed plate. The
 * Persian word sofreh (سفره), the shared spread at the heart of every
 * Iranian home, anchors the copy: authentic, never ornamental.
 */
export function HomeManifesto() {
  const ref = React.useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <section ref={ref} aria-labelledby="story-heading" className="section">
      <div className="container-shazdeh grid items-center gap-16 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6 lg:pr-10">
          <Reveal>
            <p className="eyebrow eyebrow-accent">Our story</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 id="story-heading" className="t-h2 mt-5">
              Persian heritage, set with contemporary clarity.
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="t-lead mt-8 max-w-xl space-y-5 text-dark-grey">
              <p>
                SHĀZDEH translates the Persian table into a refined,
                accessible experience for today&apos;s Dubai — cooked the
                slow way, presented with restraint.
              </p>
              <p>
                Every order is our{" "}
                <span className="whitespace-nowrap text-black-iron">
                  sofreh{" "}
                  <span lang="fa" className="text-terracotta-ink">
                    سفره
                  </span>
                </span>
                , the spread an Iranian family lays out for the people they
                love — carried from our kitchen to yours.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.18}>
            <TextLink href="/about" className="mt-10">
              Read our story
            </TextLink>
          </Reveal>
        </div>

        <div className="lg:col-span-5 lg:col-start-8">
          <Reveal className="relative mx-auto max-w-[460px]">
            <ArchLines
              count={2}
              gap={12}
              className="absolute -inset-x-4 -bottom-4 -top-4 text-terracotta/35 md:-inset-x-6 md:-top-6"
            />
            <figure>
              <div className="arch relative aspect-[3/4] overflow-hidden bg-cream">
                <motion.div
                  style={{ y: imageY }}
                  className="absolute -inset-y-[8%] inset-x-0 will-change-transform"
                >
                  <Image
                    src="/menu/baghali-polo-mahiche.jpg"
                    alt="Baghali polo ba mahiche — dill and broad-bean rice with braised lamb shank"
                    fill
                    sizes="(min-width: 1024px) 460px, 90vw"
                    className="object-cover"
                  />
                </motion.div>
              </div>
              <figcaption className="caption mt-8 text-center">
                Baghali Polo ba Mahiche
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
