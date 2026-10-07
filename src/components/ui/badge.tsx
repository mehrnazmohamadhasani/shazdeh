import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Editorial badges — caption tags in a magazine: small, tracked,
 * restrained. Terracotta is reserved for the most important marker
 * (Signature). All variants meet AA contrast at their size.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-[5px] text-[10px] font-medium uppercase leading-none tracking-[0.16em] whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-foreground)]/[0.06] text-[var(--color-foreground)] border border-[var(--color-border)]",
        terracotta: "bg-terracotta text-white border border-terracotta",
        signature:
          "bg-terracotta/[0.08] text-terracotta-ink border border-terracotta/30",
        outline:
          "bg-transparent text-[var(--color-muted-foreground)] border border-[var(--color-border)]",
        new: "bg-olive-leaf/[0.12] text-olive-leaf border border-olive-leaf/30",
        veg: "bg-olive-leaf/[0.08] text-olive-leaf border border-olive-leaf/25",
        spicy: "bg-rose-sumac/[0.08] text-rose-sumac border border-rose-sumac/25",
        soft: "bg-soft-grey/40 text-dark-grey border-transparent",
        solid: "bg-warm-white/95 text-black-iron border border-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
