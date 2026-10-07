import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * SHĀZDEH buttons.
 *
 * Minimal, pill-shaped, soft hover glow. Terracotta is reserved for
 * the primary action on a surface; everything else stays neutral.
 * Label colour on terracotta is pure white — warm white falls just
 * short of WCAG AA at button sizes.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-medium uppercase transition-[background-color,border-color,color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-terracotta text-white hover:bg-terracotta-ink glow-terracotta",
        invert:
          "bg-black-iron text-warm-white hover:bg-ash",
        light:
          "bg-warm-white text-black-iron hover:bg-white",
        secondary:
          "bg-[var(--color-card)] text-[var(--color-foreground)] hover:bg-[color-mix(in_oklab,var(--color-card)_82%,var(--color-foreground)_18%)] border border-[var(--color-border)]",
        outline:
          "border border-[var(--color-foreground)]/30 text-[var(--color-foreground)] hover:border-terracotta hover:text-terracotta-ink bg-transparent",
        "outline-light":
          "border border-warm-white/45 text-warm-white hover:border-warm-white hover:bg-warm-white/10 bg-transparent",
        ghost:
          "text-[var(--color-foreground)] hover:bg-[var(--color-foreground)]/[0.05]",
        link: "text-terracotta-ink underline-offset-4 hover:underline rounded-none normal-case tracking-normal",
        destructive:
          "bg-pomegranate-red text-warm-white hover:bg-pomegranate-red/90",
      },
      size: {
        sm: "h-10 px-5 text-[11px] tracking-[0.18em] rounded-pill",
        md: "h-12 px-7 text-[11.5px] tracking-[0.2em] rounded-pill",
        lg: "h-14 px-9 text-[12px] tracking-[0.22em] rounded-pill",
        icon: "h-11 w-11 rounded-full",
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
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
