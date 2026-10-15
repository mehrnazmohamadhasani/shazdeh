"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAdminI18n } from "@/components/admin/i18n";
import { cn } from "@/lib/utils";

/*
 * Which day the Today screen shows: one pill with the day on it that opens
 * a month calendar (a bottom sheet on phones, a small card on computers).
 * Any day up to today can be picked; future days are greyed out. Days are
 * "YYYY-MM-DD" strings in Dubai time and all maths is done in UTC, so the
 * phone's own time zone never shifts a day.
 */

const DAY_MS = 86_400_000;
const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const key = (d: Date) => d.toISOString().slice(0, 10);
const monthOf = (day: string) => day.slice(0, 7);
const addMonths = (month: string, by: number) => {
  const d = utc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return key(d).slice(0, 7);
};

/** The weeks of a month: each a row of 7 days ("" outside the month). Weeks start on `firstDay` (0 = Sunday). */
function weeks(month: string, firstDay: number) {
  const first = utc(`${month}-01`);
  const lead = (first.getUTCDay() - firstDay + 7) % 7;
  const days: string[] = Array(lead).fill("");
  for (let d = first; monthOf(key(d)) === month; d = new Date(d.getTime() + DAY_MS)) days.push(key(d));
  while (days.length % 7) days.push("");
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
}

export function DayPicker({ day, today }: { day: string; today: string }) {
  const { t, intl, locale } = useAdminI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(monthOf(day));
  const [pending, startTransition] = React.useTransition();
  // Persian calendars start the week on Saturday; Dubai's English ones on Monday.
  const firstDay = locale === "fa" ? 6 : 1;
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intl, { timeZone: "UTC", ...opts }).format(utc(d));

  function go(next: string) {
    setOpen(false);
    if (next === day) return;
    startTransition(() => router.push(next === today ? "/admin" : `/admin?day=${next}`));
  }

  const label = day === today ? t("Today") : fmt(day, { weekday: "short", day: "numeric", month: "short", year: day.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" });
  const canNext = month < monthOf(today);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setMonth(monthOf(day));
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Choose a day")}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-black-iron/[0.05] px-4 text-[14px] font-medium text-black-iron transition-colors hover:bg-black-iron/[0.08]"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4 text-terracotta-ink" strokeWidth={1.8} />}
        {label}
        <ChevronDown className="h-4 w-4 text-dark-grey" />
      </button>

      <DialogContent className="bg-white sm:max-w-[380px]">
        <DialogTitle className="px-5 pt-6 text-[20px] font-bold tracking-[-0.02em]">{t("Choose a day")}</DialogTitle>
        <DialogDescription className="sr-only">{t("Pick a day to see its sales and profit.")}</DialogDescription>

        <div className="px-4 pb-[max(1.25rem,var(--safe-bottom))] pt-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              aria-label={t("Previous month")}
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-black-iron/[0.05]"
            >
              <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" />
            </button>
            <p className="text-[16px] font-semibold">{fmt(`${month}-01`, { month: "long", year: "numeric" })}</p>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label={t("Next month")}
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-black-iron/[0.05] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-5 w-5 rtl:-scale-x-100" />
            </button>
          </div>

          <table className="mt-2 w-full table-fixed border-separate border-spacing-y-1 text-center">
            <thead>
              <tr>
                {weeks(month, firstDay)[1].map((d) => (
                  <th key={d} scope="col" className="pb-1 text-[12px] font-medium text-dark-grey">
                    {fmt(d, { weekday: "narrow" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks(month, firstDay).map((week, i) => (
                <tr key={i}>
                  {week.map((d, j) => (
                    <td key={j} className="p-0">
                      {d && (
                        <button
                          type="button"
                          disabled={d > today}
                          onClick={() => go(d)}
                          aria-current={d === day ? "date" : undefined}
                          aria-label={fmt(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                          className={cn(
                            "mx-auto grid h-11 w-11 place-items-center rounded-full text-[15px] tabular-nums transition-colors",
                            d === day
                              ? "bg-terracotta font-semibold text-white"
                              : d === today
                                ? "font-semibold text-terracotta-ink ring-1 ring-inset ring-terracotta/40 hover:bg-terracotta/[0.08]"
                                : "text-black-iron hover:bg-black-iron/[0.05]",
                            "disabled:pointer-events-none disabled:text-black-iron/25",
                          )}
                        >
                          {Number(d.slice(8))}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => go(key(new Date(utc(today).getTime() - DAY_MS)))}
              className="inline-flex min-h-12 items-center justify-center rounded-[12px] bg-black-iron/[0.05] px-3 text-[14px] font-medium active:bg-black-iron/[0.09]"
            >
              {t("Yesterday")}
            </button>
            <button
              type="button"
              onClick={() => go(today)}
              className="inline-flex min-h-12 items-center justify-center rounded-[12px] bg-terracotta px-3 text-[14px] font-medium text-white active:bg-terracotta-ink"
            >
              {t("Today")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
