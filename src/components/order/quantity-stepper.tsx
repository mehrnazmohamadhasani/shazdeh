"use client";
import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** −  2  + with 44px targets. At 1, minus becomes "remove" when allowed. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 30,
  removable = false,
  size = "md",
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  removable?: boolean;
  size?: "sm" | "md";
  label: string;
}) {
  const atMin = value <= min;
  const showRemove = removable && atMin;
  const btn = cn(
    "grid place-items-center rounded-full transition-colors disabled:opacity-30",
    size === "sm" ? "h-9 w-9" : "h-11 w-11",
    "hover:bg-black-iron/[0.06] active:bg-black-iron/[0.1]",
  );
  return (
    <div
      role="group"
      aria-label={`Quantity for ${label}`}
      className={cn(
        "inline-flex items-center rounded-full border border-black-iron/15 bg-warm-white",
        size === "sm" ? "h-9" : "h-11",
      )}
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={atMin && !removable}
        aria-label={showRemove ? `Remove ${label}` : `One less ${label}`}
      >
        {showRemove ? (
          <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.6} />
        ) : (
          <Minus className="h-4 w-4" strokeWidth={1.6} />
        )}
      </button>
      <span
        aria-live="polite"
        className={cn("min-w-6 text-center font-semibold tabular-nums", size === "sm" ? "text-[13px]" : "text-[15px]")}
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`One more ${label}`}
      >
        <Plus className="h-4 w-4" strokeWidth={1.6} />
      </button>
    </div>
  );
}
