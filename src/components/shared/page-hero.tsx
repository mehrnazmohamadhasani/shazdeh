import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";

/*
 * Page hero — used by /menu, /about, /gallery, /contact.
 * Editorial, calm, set on warm white. Inter Bold, tight tracking,
 * generous space above the fold.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative pt-40 pb-20 md:pt-56 md:pb-28 lg:pt-64 lg:pb-32",
        className,
      )}
    >
      <div
        className={cn(
          "container-shazdeh",
          align === "center" && "text-center",
        )}
      >
        {eyebrow && (
          <Reveal>
            <p className="eyebrow">{eyebrow}</p>
          </Reveal>
        )}
        <Reveal delay={0.08}>
          <h1 className="mt-6 font-bold text-[12vw] md:text-[5.5rem] lg:text-[7.5rem] leading-[0.92] tracking-[-0.05em] max-w-6xl">
            {title}
          </h1>
        </Reveal>
        {description && (
          <Reveal delay={0.18}>
            <p className="mt-8 max-w-xl text-[16px] md:text-[18px] font-light text-[var(--color-foreground)]/65 leading-[1.55]">
              {description}
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
