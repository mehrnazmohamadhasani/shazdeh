import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-12 w-full rounded-md border border-[var(--color-border)] bg-transparent px-4 py-2 text-[14px] font-light text-[var(--color-foreground)] placeholder:text-[var(--color-foreground)]/40 transition-colors",
      "focus:outline-none focus:ring-1 focus:ring-terracotta/40 focus:border-terracotta/60",
      "disabled:cursor-not-allowed disabled:opacity-40",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[120px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-4 py-3 text-[14px] font-light text-[var(--color-foreground)] placeholder:text-[var(--color-foreground)]/40 transition-colors leading-relaxed",
      "focus:outline-none focus:ring-1 focus:ring-terracotta/40 focus:border-terracotta/60",
      "disabled:cursor-not-allowed disabled:opacity-40 resize-y",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Input, Textarea };
