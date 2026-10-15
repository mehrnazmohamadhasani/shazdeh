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
