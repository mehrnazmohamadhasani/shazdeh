import "server-only";
import { prisma } from "@/lib/prisma";
import { OpsError, dubaiDate } from "./documents";
import { cashBalances, cashByMonth, personKey } from "./cash-balance";

/*
 * Owner cash. The owner (or a staff member) pays suppliers with their own
 * money or with cash taken from the business account, and must present
 * the invoices. Withdrawals (money taken, or paid back to them) are
 * recorded here; the invoices are the ones marked "paid with own money"
 * by that person. The balance shows cash still waiting for invoices, or
 * money the business owes them — also month by month.
 */

type Actor = { id: string; email: string };

export async function ownerCash() {
  const [withdrawals, invoices] = await Promise.all([
    prisma.cashWithdrawal.findMany({ where: { voidedAt: null }, orderBy: { at: "desc" } }),
    prisma.purchaseInvoice.findMany({
      where: { voidedAt: null, paidPersonally: true, paidBy: { not: null }, paidAt: { not: null } },
      orderBy: { paidAt: "desc" },
      select: { id: true, documentId: true, invoiceNo: true, invoiceDate: true, paidAt: true, totalFils: true, paidBy: true, supplier: { select: { name: true } } },
    }),
  ]);
  const taken = withdrawals.map((w) => ({ person: w.person, amountFils: w.amountFils, at: w.at }));
  const paid = invoices.map((i) => ({ person: i.paidBy!, amountFils: i.totalFils, at: i.paidAt! }));
  const months = cashByMonth(taken, paid);
  const people = cashBalances(taken, paid).map((p) => ({ ...p, months: months.get(personKey(p.person)) ?? [] }));
  return { people, withdrawals: withdrawals.slice(0, 50), invoices: invoices.slice(0, 50) };
}

export async function addWithdrawal(input: { person: string; amountFils: number; day: string; note: string | null }, actor: Actor) {
  const at = dubaiDate(input.day);
  return prisma.$transaction(async (tx) => {
    const row = await tx.cashWithdrawal.create({
      data: { person: input.person, amountFils: input.amountFils, at, note: input.note, createdById: actor.id },
    });
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "cash_withdrawal.create",
        entity: "CashWithdrawal",
        entityId: row.id,
        after: { person: row.person, amountFils: row.amountFils, day: input.day, note: row.note },
      },
    });
    return row;
  });
}

/** Removes a withdrawal entered by mistake. The row stays, marked void, for the audit trail. */
export async function voidWithdrawal(id: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.cashWithdrawal.findUnique({ where: { id } });
    if (!row) throw new OpsError("Withdrawal not found.", 404);
    if (row.voidedAt) throw new OpsError("This withdrawal is already removed.", 409);
    await tx.cashWithdrawal.update({ where: { id }, data: { voidedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        actor: actor.email,
        action: "cash_withdrawal.void",
        entity: "CashWithdrawal",
        entityId: id,
        before: { person: row.person, amountFils: row.amountFils, at: row.at.toISOString(), note: row.note },
      },
    });
  });
}
