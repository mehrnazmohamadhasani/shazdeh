/* eslint-disable @next/next/no-img-element -- logos are small SVG/PNG brand assets of unknown aspect ratio */
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────
 * SHĀZDEH wordmark
 *
 * Per the brand guidelines the logotype is a high-contrast Didone
 * with the macron Ā, and "PERSIAN CUISINE" set beneath it in a
 * tracked sans as the secondary descriptor.
 *
 *   – If an official logo file is uploaded (Settings → Logo URL),
 *     it is rendered as-is — never redrawn.
 *   – Otherwise the lockup is typeset in Bodoni Moda, the closest
 *     open-licence match to the logotype.
 * ──────────────────────────────────────────────────────────────── */

const SIZES = {
  xs: "text-[13px]",
  sm: "text-[17px]",
  md: "text-[22px]",
  lg: "text-[30px]",
  xl: "text-[44px] md:text-[60px]",
  "2xl": "text-[72px] md:text-[112px]",
  "3xl": "text-[112px] md:text-[180px]",
} as const;

const LOGO_HEIGHT = {
  xs: "h-4",
  sm: "h-6",
  md: "h-8",
  lg: "h-11",
  xl: "h-16 md:h-20",
  "2xl": "h-24 md:h-36",
  "3xl": "h-36 md:h-56",
} as const;

export type WordmarkSize = keyof typeof SIZES;

export function Wordmark({
  size = "md",
  className,
  withDescriptor = false,
  descriptor = "Persian Cuisine",
  logoUrl,
}: {
  size?: WordmarkSize;
  className?: string;
  withDescriptor?: boolean;
  descriptor?: string;
  logoUrl?: string | null;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="SHĀZDEH — Persian Cuisine"
        className={cn("w-auto select-none", LOGO_HEIGHT[size], className)}
        draggable={false}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex flex-col items-center leading-none",
        className,
      )}
    >
      <span
        className={cn(
          "font-[family-name:var(--font-logo)] font-medium uppercase whitespace-nowrap",
          SIZES[size],
        )}
        style={{ letterSpacing: "0.035em", fontOpticalSizing: "auto" }}
      >
        SHĀZDEH
      </span>
      {withDescriptor && (
        <span
          className={cn(
            "mt-[0.45em] font-sans font-medium uppercase",
            descriptorSize(size),
          )}
          style={{ letterSpacing: "0.28em" }}
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
      return "text-[7px]";
    case "md":
      return "text-[8px]";
    case "lg":
      return "text-[10px]";
    case "xl":
      return "text-[11px] md:text-[13px]";
    case "2xl":
    case "3xl":
      return "text-[14px]";
  }
}
