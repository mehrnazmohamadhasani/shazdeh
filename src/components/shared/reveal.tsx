"use client";
import * as React from "react";
import { motion, useInView, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

/*
 * Reveal — calm, slow, editorial. Per the brand guidelines:
 * smooth scrolling · fade reveals · soft hover. Avoid flashy.
 */

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Reveal({
  children,
  className,
  delay = 0,
  amount = 0.2,
  once = true,
  variants = defaultVariants,
  duration = 1.0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  amount?: number;
  once?: boolean;
  variants?: Variants;
  duration?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount, once });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variants}
      transition={{ duration, delay, ease: EASE }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function RevealStagger({
  children,
  className,
  delay = 0,
  stagger = 0.08,
  once = true,
  amount = 0.2,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
  once?: boolean;
  amount?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount, once });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  duration = 1.0,
}: {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration, ease: EASE }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
