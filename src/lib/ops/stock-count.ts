/*
 * When a stock count was taken. A count is compared with the ledger as
 * it stood at that moment, so movements dated later (a sale this
 * morning, waste entered for today) still count after a count that is
 * entered late for an earlier day. Pure, so it is tested on its own.
 */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Today: now. An earlier day: the end of that Dubai day (UTC+4, no DST).
 * A future day or a date that isn't one: null.
 */
export function countTime(day: string, now = new Date()): Date | null {
  if (!DAY_RE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return null;
  const today = new Date(now.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);
  if (day > today) return null;
  return day === today ? now : new Date(`${day}T23:59:59.999+04:00`);
}
