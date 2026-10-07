"use client";
import * as React from "react";
import { motion, type Variants } from "motion/react";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/*
 * Reveal — calm fade-up on scroll. Per the brand guidelines: smooth
 * scrolling, fade reveals, soft hover; nothing flashy. Travel is kept
 * short (16px) and durations under a second so content never feels
 * like it is waiting to appear.
 */

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function Reveal({
  children,
  className,
  delay = 0,
  amount = 0.2,
  variants = defaultVariants,
  duration = 0.85,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  amount?: number;
  variants?: Variants;
  duration?: number;
  as?: "div" | "li" | "figure";
}) {
  const Comp = motion[as];
  return (
    <Comp
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={variants}
      transition={{ duration, delay, ease: EASE }}
      className={cn(className)}
    >
      {children}
    </Comp>
  );
}

export function RevealStagger({
  children,
  className,
  delay = 0,
  stagger = 0.08,
  amount = 0.15,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
  amount?: number;
  as?: "div" | "ul" | "ol";
}) {
  const Comp = motion[as];
  return (
    <Comp
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
      className={cn(className)}
    >
      {children}
    </Comp>
  );
}

export function RevealItem({
  children,
  className,
  duration = 0.85,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  as?: "div" | "li" | "article";
}) {
  const Comp = motion[as];
  return (
    <Comp
      variants={defaultVariants}
      transition={{ duration, ease: EASE }}
      className={cn(className)}
    >
      {children}
    </Comp>
  );
}
