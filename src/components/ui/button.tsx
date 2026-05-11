import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * SHĀZDEH buttons.
 *
 * Per the brand guidelines: minimal, rounded but refined, soft hover
 * glow, elegant transitions. Terracotta is used sparingly for primary
 * CTAs only — secondary affordances stay neutral.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 group/btn relative overflow-hidden",
  {
    variants: {
      variant: {
        primary:
          "bg-terracotta text-warm-white hover:bg-[oklch(from_var(--color-terracotta)_calc(l-0.04)_c_h)] glow-terracotta",
        invert:
          "bg-black-iron text-warm-white hover:bg-black-iron/90 dark:bg-warm-white dark:text-black-iron",
        secondary:
          "bg-[var(--color-card)] text-[var(--color-foreground)] hover:bg-[color-mix(in_oklab,var(--color-card)_82%,var(--color-foreground)_18%)] border border-[var(--color-border)]",
        outline:
          "border border-[var(--color-foreground)]/30 text-[var(--color-foreground)] hover:border-terracotta hover:text-terracotta bg-transparent",
        ghost:
          "text-[var(--color-foreground)] hover:bg-[var(--color-foreground)]/[0.05]",
        link:
          "text-terracotta underline-offset-4 hover:underline rounded-none",
        destructive:
          "bg-pomegranate-red text-warm-white hover:bg-pomegranate-red/90",
      },
      size: {
        sm:   "h-9 px-5 text-[11px] tracking-[0.18em] uppercase rounded-pill",
        md:   "h-11 px-7 text-[12px] tracking-[0.18em] uppercase rounded-pill",
        lg:   "h-14 px-9 text-[12px] tracking-[0.22em] uppercase rounded-pill",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
