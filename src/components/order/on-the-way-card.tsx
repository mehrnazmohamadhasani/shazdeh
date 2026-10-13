"use client";
import * as React from "react";
import { Home } from "lucide-react";
import { SCOOTER_VIEWBOX, scooterMarkup } from "@/components/order/scooter-art";

/*
 * "On its way" card for the tracking page, in the spirit of the
 * delivery apps' live activities. There is no rider GPS, so the scooter
 * moves along an estimate: from the moment staff marked the order out
 * for delivery to the promised latest arrival time. It never reaches
 * the door on its own — that happens when staff mark it delivered.
 */

const MIN_RIDE_MS = 10 * 60_000;

const COLORS = {
  body: "#fdf6ec",
  wheel: "#000000",
  rim: "#fdf6ec",
  box: "#ce4927",
  mark: "#fdf6ec",
  light: "#d68a64",
};

export function Scooter({ className }: { className?: string }) {
  const id = React.useId();
  const markup = React.useMemo(() => scooterMarkup(COLORS, { id }), [id]);
  return <svg aria-hidden viewBox={SCOOTER_VIEWBOX} className={className} dangerouslySetInnerHTML={{ __html: markup }} />;
}

function clock(ms: number) {
  return new Intl.DateTimeFormat("en-AE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Dubai",
  }).format(new Date(ms));
}

export function OnTheWayCard({
  dispatchedAt,
  placedAt,
  etaMax,
  driverName,
}: {
  dispatchedAt: string;
  placedAt: string;
  etaMax: number;
  driverName?: string | null;
}) {
  // Client clock only — avoids a server/client mismatch on first render.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const start = Date.parse(dispatchedAt);
  const eta = Math.max(Date.parse(placedAt) + etaMax * 60_000, start + MIN_RIDE_MS);
  const progress = now === null ? 8 : Math.min(86, Math.max(8, ((now - start) / (eta - start)) * 100));
  const minutes = now === null ? null : Math.ceil((eta - now) / 60_000);
  // The scooter's front sits at the progress point; the first 40px keep
  // its body (and speed lines) inside the card at the start of the ride.
  const at = `calc(40px + (100% - 40px) * ${progress / 100})`;

  return (
    <div className="mt-7 max-w-xl rounded-[22px] border border-white/10 bg-gradient-to-br from-white/[0.10] to-white/[0.03] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0" aria-live="polite">
          <p className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.22em] text-apricot-clay tabular-nums">
            Arrival by {clock(eta)}
          </p>
          <p className="mt-2 text-[1.5rem] font-bold leading-tight tracking-[-0.03em] tabular-nums sm:text-[1.75rem]">
            {minutes === null ? "On its way" : minutes > 1 ? `Arrives in about ${minutes} min` : "Arriving any minute"}
          </p>
          <p className="mt-1 text-[14px] text-warm-white/70">
            {driverName ? `${driverName} is bringing your order.` : "Your rider is bringing your order."}
          </p>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-terracotta/15 ring-1 ring-terracotta/30 sm:h-16 sm:w-16">
          <Scooter className="w-10 sm:w-12" />
        </div>
      </div>

      <div className="relative mt-8 h-10" role="img" aria-label={`Delivery about ${Math.round(progress)}% of the way`}>
        <div className="absolute inset-y-0 left-0 right-9">
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/[0.12]" />
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-terracotta to-apricot-clay transition-[width] duration-1000 ease-out"
            style={{ width: at }}
          />
          <span
            aria-hidden
            className="absolute top-1/2 transition-[left] duration-1000 ease-out"
            style={{ left: at, translate: "-60% -90%" }}
          >
            <span className="absolute -left-4 top-[40%] flex flex-col gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block h-0.5 w-3 origin-right rounded-full bg-warm-white/50 opacity-0 motion-safe:animate-[speed-line_0.9s_linear_infinite]"
                  style={{ animationDelay: `${i * 0.3}s` }}
                />
              ))}
            </span>
            <Scooter className="relative block w-16 motion-safe:animate-[scooter-ride_1.1s_ease-in-out_infinite]" />
          </span>
        </div>
        <span
          aria-hidden
          className="absolute right-0 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-warm-white text-black-iron"
        >
          <Home className="h-4 w-4" strokeWidth={1.8} />
        </span>
      </div>
    </div>
  );
}
