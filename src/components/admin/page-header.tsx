import * as React from "react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-8 border-b border-warm-white/[0.08]",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-4 font-bold text-3xl md:text-5xl text-warm-white tracking-[-0.04em] leading-[0.96]">
          {title}
        </h1>
        {description && (
          <p className="mt-4 text-warm-white/60 text-[14px] md:text-[15px] max-w-2xl font-light leading-[1.6]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
