"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAdminI18n } from "@/components/admin/i18n";
import { cn } from "@/lib/utils";

/*
 * Which month a screen shows: one pill with the month on it that opens a
 * year of months to tap (a bottom sheet on phones, a small card on
 * computers) — the month twin of Today's day picker. Months after the
 * current one are greyed out. Months are "YYYY-MM"; the page reads them
 * from `?month=`, and the current month is the bare path.
 */

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

export function MonthPicker({ month, current, path }: { month: string; current: string; path: string }) {
  const { t, intl } = useAdminI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [year, setYear] = React.useState(Number(month.slice(0, 4)));
  const [pending, startTransition] = React.useTransition();
  const thisYear = Number(current.slice(0, 4));
  const fmt = (m: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intl, { timeZone: "UTC", ...opts }).format(new Date(`${m}-01T00:00:00Z`));

  function go(next: string) {
    setOpen(false);
    if (next === month) return;
    startTransition(() => router.push(next === current ? path : `${path}?month=${next}`));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setYear(Number(month.slice(0, 4)));
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Choose a month")}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-black-iron/[0.05] px-4 text-[15px] font-semibold text-black-iron transition-colors hover:bg-black-iron/[0.08]"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4 text-terracotta-ink" strokeWidth={1.8} />}
        {fmt(month, { month: "long", year: "numeric" })}
        <ChevronDown className="h-4 w-4 text-dark-grey" />
      </button>

      <DialogContent className="bg-white sm:max-w-[380px]">
        <DialogTitle className="px-5 pt-6 text-[20px] font-bold tracking-[-0.02em]">{t("Choose a month")}</DialogTitle>
        <DialogDescription className="sr-only">{t("Pick a month to see its sales.")}</DialogDescription>

        <div className="px-4 pb-[max(1.25rem,var(--safe-bottom))] pt-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={() => setYear(year - 1)}
              aria-label={t("Previous year")}
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-black-iron/[0.05]"
            >
              <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" />
            </button>
            <p className="text-[16px] font-semibold tabular-nums">{year}</p>
            <button
              type="button"
              disabled={year >= thisYear}
              onClick={() => setYear(year + 1)}
              aria-label={t("Next year")}
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-black-iron/[0.05] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-5 w-5 rtl:-scale-x-100" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {MONTHS.map((mm) => {
              const m = `${year}-${mm}`;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={m > current}
                  onClick={() => go(m)}
                  aria-current={m === month ? "date" : undefined}
                  aria-label={fmt(m, { month: "long", year: "numeric" })}
                  className={cn(
                    "min-h-12 rounded-[12px] px-2 text-[14.5px] transition-colors",
                    m === month
                      ? "bg-terracotta font-semibold text-white"
                      : m === current
                        ? "font-semibold text-terracotta-ink ring-1 ring-inset ring-terracotta/40 hover:bg-terracotta/[0.08]"
                        : "bg-black-iron/[0.03] text-black-iron hover:bg-black-iron/[0.06]",
                    "disabled:pointer-events-none disabled:bg-transparent disabled:text-black-iron/25",
                  )}
                >
                  {fmt(m, { month: "short" })}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => go(current)}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-[12px] bg-terracotta px-3 text-[14px] font-medium text-white active:bg-terracotta-ink"
          >
            {t("This month")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
