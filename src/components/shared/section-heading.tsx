import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/*
 * Editorial section heading. Inter Bold, tight tracking, generous
 * scale. The eyebrow is brand 6%-tracked and very small.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  size = "default",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    <div
      className={cn(
        "max-w-4xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && (
        <Reveal>
          <p className="eyebrow">{eyebrow}</p>
        </Reveal>
      )}
      <Reveal delay={0.08}>
        <h2
          className={cn(
            "mt-6 font-bold tracking-[-0.045em] leading-[0.94]",
            size === "lg"
              ? "text-5xl md:text-7xl lg:text-8xl"
              : "text-4xl md:text-6xl lg:text-7xl",
          )}
        >
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal delay={0.16}>
          <div className="mt-6 text-[16px] md:text-[18px] font-light text-[var(--color-foreground)]/65 leading-[1.55] max-w-2xl">
            {description}
          </div>
        </Reveal>
      )}
    </div>
  );
}
