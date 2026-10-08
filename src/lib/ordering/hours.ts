/*
 * Delivery-hours evaluation in the kitchen's timezone (Asia/Dubai has no
 * DST, but nothing here assumes that). Hours use the same JSON shape as
 * the site's opening hours: { mon: "12:00 — 23:00", … }. Windows may run
 * past midnight ("18:00 — 02:00") and "Closed" (or a missing day) closes
 * the kitchen that day.
 */

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type DayKey = (typeof DAYS)[number];

const DAY_LABEL: Record<DayKey, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

type Window = { open: number; close: number };

export function parseWindow(raw: string | undefined | null): Window | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})\s*[—–-]+\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const open = Number(m[1]) * 60 + Number(m[2]);
  let close = Number(m[3]) * 60 + Number(m[4]);
  if (close <= open) close += 24 * 60; // runs past midnight
  return { open, close };
}

function parseWeek(raw: string | null): Partial<Record<DayKey, Window | null>> | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const week: Partial<Record<DayKey, Window | null>> = {};
    for (const day of DAYS) {
      const v = obj[day];
      week[day] = typeof v === "string" ? parseWindow(v) : null;
    }
    return week;
  } catch {
    return null;
  }
}

/** Day-of-week and minutes since midnight in the given timezone. */
export function localClock(now: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = DAYS.indexOf(get("weekday").toLowerCase().slice(0, 3) as DayKey);
  return { day: day < 0 ? 0 : day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function hhmm(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export type KitchenStatus = {
  isOpen: boolean;
  /** "Open until 23:00" / "Opens today at 12:00" / "Opens Monday at 12:00" */
  label: string;
  closesAt: string | null;
  opensAt: string | null;
};

export function kitchenStatus(
  hoursJson: string | null,
  timeZone: string,
  now = new Date(),
): KitchenStatus {
  const week = parseWeek(hoursJson);
  // No hours configured: the accepting-orders switch is the only gate.
  if (!week) return { isOpen: true, label: "Open now", closesAt: null, opensAt: null };

  const { day, minutes } = localClock(now, timeZone);
  const today = week[DAYS[day]] ?? null;
  const yesterday = week[DAYS[(day + 6) % 7]] ?? null;

  if (yesterday && yesterday.close > 1440 && minutes < yesterday.close - 1440) {
    const closesAt = hhmm(yesterday.close);
    return { isOpen: true, label: `Open until ${closesAt}`, closesAt, opensAt: null };
  }
  if (today && minutes >= today.open && minutes < today.close) {
    const closesAt = hhmm(today.close);
    return { isOpen: true, label: `Open until ${closesAt}`, closesAt, opensAt: null };
  }

  if (today && minutes < today.open) {
    const opensAt = hhmm(today.open);
    return { isOpen: false, label: `Opens today at ${opensAt}`, closesAt: null, opensAt };
  }
  for (let i = 1; i <= 7; i++) {
    const key = DAYS[(day + i) % 7];
    const w = week[key];
    if (w) {
      const opensAt = hhmm(w.open);
      const when = i === 1 ? "tomorrow" : DAY_LABEL[key];
      return { isOpen: false, label: `Opens ${when} at ${opensAt}`, closesAt: null, opensAt };
    }
  }
  return { isOpen: false, label: "Closed", closesAt: null, opensAt: null };
}
