import { cn } from "@/lib/utils";

/*
 * Page hero — used by /menu, /about, /gallery, /order.
 * Editorial and calm on warm white, or full-bleed over video.
 *
 * The entrance uses CSS keyframes rather than JS so the headline (the
 * page's LCP element) paints immediately, before hydration.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  align = "left",
  size = "default",
  videoSrc,
  posterSrc,
  aside,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  /** "compact" keeps utility pages (menu, order) close to their content */
  size?: "default" | "compact";
  videoSrc?: string;
  posterSrc?: string;
  /** Optional element rendered beside the copy on large screens */
  aside?: React.ReactNode;
  className?: string;
}) {
  const hasVideo = Boolean(videoSrc);

  return (
    <section
      className={cn(
        "relative overflow-hidden",
        hasVideo
          ? "flex h-[100svh] min-h-[640px] flex-col justify-end bg-black-iron pb-20 pt-40 text-warm-white md:pb-28"
          : size === "compact"
            ? "pb-12 pt-32 md:pb-16 md:pt-44"
            : "pb-16 pt-36 md:pb-24 md:pt-52 lg:pt-56",
        className,
      )}
    >
      {hasVideo && (
        <>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={posterSrc}
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black-iron/75 via-black-iron/35 to-black-iron/25"
          />
        </>
      )}

      <div
        className={cn(
          "container-shazdeh relative z-10",
          aside && "grid items-end gap-12 lg:grid-cols-12",
          align === "center" && "text-center",
        )}
      >
        <div className={cn(aside && "lg:col-span-7")}>
          {eyebrow && (
            <p
              className={cn(
                "eyebrow animate-rise",
                hasVideo ? "text-warm-white/80" : "eyebrow-accent",
              )}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className={cn(
              "mt-5 max-w-5xl animate-rise [animation-delay:60ms]",
              size === "compact" ? "t-h1" : "t-display",
              align === "center" && "mx-auto",
            )}
          >
            {title}
          </h1>
          {description && (
            <p
              className={cn(
                "t-lead mt-7 max-w-xl animate-rise [animation-delay:140ms]",
                hasVideo ? "text-warm-white/85" : "text-dark-grey",
                align === "center" && "mx-auto",
              )}
            >
              {description}
            </p>
          )}
        </div>
        {aside && (
          <div className="animate-rise [animation-delay:200ms] lg:col-span-5">
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
