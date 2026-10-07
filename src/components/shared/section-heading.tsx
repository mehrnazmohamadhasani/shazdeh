import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/*
 * Editorial section heading: eyebrow, headline, optional lead and an
 * optional quiet text link aligned to the baseline on large screens.
 * One component so every section shares the same hierarchy.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  link,
  align = "left",
  as: Heading = "h2",
  id,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  link?: { href: string; label: string };
  align?: "left" | "center";
  as?: "h1" | "h2";
  /** id for the heading, so sections can be aria-labelledby it */
  id?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-8 lg:grid-cols-12 lg:items-end",
        align === "center" && "text-center",
        className,
      )}
    >
      <div
        className={cn(
          link ? "lg:col-span-8" : "lg:col-span-10",
          align === "center" && "lg:col-span-12 mx-auto max-w-3xl",
        )}
      >
        {eyebrow && (
          <Reveal>
            <p className="eyebrow eyebrow-accent">{eyebrow}</p>
          </Reveal>
        )}
        <Reveal delay={0.06}>
          <Heading id={id} className="t-h2 mt-5">
            {title}
          </Heading>
        </Reveal>
        {description && (
          <Reveal delay={0.12}>
            <p
              className={cn(
                "t-lead mt-6 max-w-2xl text-dark-grey",
                align === "center" && "mx-auto",
              )}
            >
              {description}
            </p>
          </Reveal>
        )}
      </div>
      {link && (
        <Reveal delay={0.16} className="lg:col-span-4 lg:text-right">
          <TextLink href={link.href}>{link.label}</TextLink>
        </Reveal>
      )}
    </div>
  );
}

export function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex min-h-11 items-center gap-3 text-[11.5px] font-medium uppercase tracking-[0.22em]",
        className,
      )}
    >
      <span className="link-underline">{children}</span>
      <ArrowRight
        className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1"
        strokeWidth={1.5}
      />
    </Link>
  );
}
