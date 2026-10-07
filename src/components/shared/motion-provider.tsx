"use client";
import { MotionConfig } from "motion/react";

/**
 * Every Motion animation on the public site honours the visitor's
 * reduced-motion preference (transforms are dropped, fades remain).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
