/*
 * Per person: cash taken from the business account vs invoices presented.
 * Names are matched loosely ("owner", " Owner ") and shown as first typed.
 */

export type CashEntry = { person: string; amountFils: number };
export type CashBalance = {
  person: string;
  withdrawnFils: number;
  presentedFils: number;
  /** > 0: cash still waiting for invoices. < 0: the business owes them. */
  balanceFils: number;
};

const key = (person: string) => person.trim().replace(/\s+/g, " ").toLowerCase();

export function cashBalances(withdrawals: CashEntry[], presented: CashEntry[]): CashBalance[] {
  const byPerson = new Map<string, CashBalance>();
  const row = (person: string) => {
    const k = key(person);
    let r = byPerson.get(k);
    if (!r) byPerson.set(k, (r = { person: person.trim().replace(/\s+/g, " "), withdrawnFils: 0, presentedFils: 0, balanceFils: 0 }));
    return r;
  };
  for (const w of withdrawals) row(w.person).withdrawnFils += w.amountFils;
  for (const p of presented) row(p.person).presentedFils += p.amountFils;
  const rows = [...byPerson.values()];
  for (const r of rows) r.balanceFils = r.withdrawnFils - r.presentedFils;
  return rows.sort((a, b) => Math.abs(b.balanceFils) - Math.abs(a.balanceFils) || a.person.localeCompare(b.person));
}

export type DatedCashEntry = CashEntry & { at: Date };
export type CashMonth = {
  /** "2026-10" (Dubai). */
  month: string;
  withdrawnFils: number;
  presentedFils: number;
  /** The person's balance at the end of this month, everything before included. */
  endBalanceFils: number;
};

const dubaiMonth = (at: Date) => new Date(at.getTime() + 4 * 3_600_000).toISOString().slice(0, 7);

/**
 * Per person, month by month: what they took, what they paid for, and
 * where their balance stood at the end of the month (< 0: the business
 * owes them). Newest month first, keyed like cashBalances.
 */
export function cashByMonth(withdrawals: DatedCashEntry[], presented: DatedCashEntry[]): Map<string, CashMonth[]> {
  const byPerson = new Map<string, Map<string, CashMonth>>();
  const cell = (e: DatedCashEntry) => {
    const k = key(e.person);
    let months = byPerson.get(k);
    if (!months) byPerson.set(k, (months = new Map()));
    const m = dubaiMonth(e.at);
    let c = months.get(m);
    if (!c) months.set(m, (c = { month: m, withdrawnFils: 0, presentedFils: 0, endBalanceFils: 0 }));
    return c;
  };
  for (const w of withdrawals) cell(w).withdrawnFils += w.amountFils;
  for (const p of presented) cell(p).presentedFils += p.amountFils;
  const out = new Map<string, CashMonth[]>();
  for (const [k, months] of byPerson) {
    const rows = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
    let running = 0;
    for (const r of rows) r.endBalanceFils = running += r.withdrawnFils - r.presentedFils;
    out.set(k, rows.reverse());
  }
  return out;
}

export { key as personKey };
