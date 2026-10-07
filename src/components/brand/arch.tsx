import { cn } from "@/lib/utils";

/*
 * The Persian arch (iwan) as a hairline drawing — lifted from the
 * brand's social templates, where nested arches frame type and food.
 * Drawn with CSS borders so the crown stays a true semicircle at any
 * size. Purely decorative: aria-hidden, coloured by currentColor.
 */
export function ArchLines({
  className,
  count = 1,
  gap = 14,
}: {
  className?: string;
  /** Nested arches drawn inside one another */
  count?: 1 | 2 | 3;
  /** Distance between nested arches, px */
  gap?: number;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none relative", className)}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="arch absolute border border-b-0 border-current"
          style={{ inset: `${i * gap}px ${i * gap}px 0 ${i * gap}px` }}
        />
      ))}
    </div>
  );
}
