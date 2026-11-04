"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/** A labelled text input for the ordering forms (checkout, delivery address). */
export function Field({
  label,
  value,
  onChange,
  error,
  optional,
  hint,
  className,
  ...input
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  optional?: boolean;
  hint?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = React.useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline justify-between text-[12.5px] font-medium">
        {label}
        {optional && <span className="text-[11.5px] font-normal text-dark-grey">Optional</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-d` : undefined}
        className={cn(
          "mt-1.5 h-12 w-full rounded-[10px] border bg-white/60 px-3.5 text-[15px] focus:outline-none focus:ring-1",
          error ? "border-rose-sumac focus:ring-rose-sumac/40" : "border-black-iron/15 focus:border-terracotta/60 focus:ring-terracotta/40",
        )}
        {...input}
      />
      {(error || hint) && (
        <p id={`${id}-d`} className={cn("mt-1 text-[12px]", error ? "text-rose-sumac" : "text-dark-grey")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
