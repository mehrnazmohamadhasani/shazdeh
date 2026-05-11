import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Editorial badges. Per the brand book the badges should feel like
 * caption tags in a magazine — small, tracked, restrained. Terracotta
 * is reserved for the most important markers (Signature, New).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[9px] font-medium tracking-[0.22em] uppercase whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-foreground)]/[0.06] text-[var(--color-foreground)] border border-[var(--color-border)]",
        terracotta:
          "bg-terracotta text-warm-white border border-terracotta",
        signature:
          "bg-terracotta/10 text-terracotta border border-terracotta/30",
        outline:
          "bg-transparent text-[var(--color-foreground)]/70 border border-[var(--color-border)]",
        new:
          "bg-olive-leaf/15 text-olive-leaf border border-olive-leaf/30",
        veg:
          "bg-olive-leaf/10 text-olive-leaf border border-olive-leaf/25",
        spicy:
          "bg-rose-sumac/15 text-rose-sumac border border-rose-sumac/25",
        soft:
          "bg-soft-grey/40 text-graphite border-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
