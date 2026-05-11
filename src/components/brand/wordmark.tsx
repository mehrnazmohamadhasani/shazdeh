import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────
 * SHĀZDEH wordmark
 *
 * Per the official brand guidelines:
 *   – Always set in Inter, Bold/Heavy
 *   – Always with the macron on the Ā (uppercase A with combining
 *     macron · U+0100)
 *   – Tracked at ~6% (uppercase tracking)
 *   – Brand descriptor "Persian Cuisine" sits below as secondary,
 *     never overpowering the logotype
 *   – Approved colour pairings only (black on warm white, warm
 *     white on black, terracotta only on neutral grounds)
 * ──────────────────────────────────────────────────────────────── */

const SIZES = {
  xs: "text-[11px]",
  sm: "text-[13px]",
  md: "text-[16px]",
  lg: "text-[22px]",
  xl: "text-[42px] md:text-[56px]",
  "2xl": "text-[72px] md:text-[112px]",
  "3xl": "text-[112px] md:text-[180px]",
} as const;

export type WordmarkSize = keyof typeof SIZES;

export function Wordmark({
  size = "md",
  className,
  withDescriptor = false,
  descriptor = "Persian Cuisine",
}: {
  size?: WordmarkSize;
  className?: string;
  withDescriptor?: boolean;
  descriptor?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex flex-col items-start leading-none",
        className,
      )}
    >
      <span
        className={cn(
          "font-sans font-bold uppercase tracking-brand whitespace-nowrap",
          SIZES[size],
        )}
        style={{ letterSpacing: "0.06em" }}
      >
        SHĀZDEH
      </span>
      {withDescriptor && (
        <span
          className={cn(
            "mt-1.5 font-sans font-medium uppercase tracking-[0.32em]",
            descriptorSize(size),
          )}
          style={{ opacity: 0.65 }}
        >
          {descriptor}
        </span>
      )}
    </span>
  );
}

function descriptorSize(size: WordmarkSize): string {
  switch (size) {
    case "xs":
    case "sm":
      return "text-[8px] tracking-[0.28em]";
    case "md":
      return "text-[9px]";
    case "lg":
      return "text-[10px]";
    case "xl":
      return "text-[11px]";
    case "2xl":
    case "3xl":
      return "text-[13px]";
  }
}
