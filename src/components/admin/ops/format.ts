import type { BaseUnit } from "@/lib/ops/units";

/** Shared display helpers for the purchasing screens (Dubai time). */

export const UNIT: Record<string, BaseUnit> = { G: "g", ML: "ml", PCS: "pcs" };

export function day(d: Date | string, withYear = false) {
  return new Intl.DateTimeFormat("en-AE", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "Asia/Dubai",
  }).format(new Date(d));
}

/** Cost per kg / L / piece, from fils per g / ml / piece. */
export function unitPrice(filsPerBase: number, unit: BaseUnit) {
  const per = unit === "pcs" ? 1 : 1000;
  return `${((filsPerBase * per) / 100).toFixed(2)} AED / ${unit === "g" ? "kg" : unit === "ml" ? "L" : "pc"}`;
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
