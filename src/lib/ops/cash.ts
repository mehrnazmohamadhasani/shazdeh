import "server-only";
import { prisma } from "@/lib/prisma";
import { OpsError, dubaiDate } from "./documents";
import { cashBalances } from "./cash-balance";

/*
 * Owner cash. The owner (or a staff member) pays suppliers in cash or by
 * card, takes the money back from the business account, and must present
 * the invoices. Withdrawals are recorded here; the invoices are the
 * cash/card purchase invoices whose "Paid by" is that person. The
 * balance shows cash still waiting for invoices, or money owed to them.
 */

type Actor = { id: string; email: string };

/** Invoices paid on the spot by a person (not credit invoices paid later from the business account). */
const PRESENTED_MODES = ["cash", "card"];

export async function ownerCash() {
  const [withdrawals, invoices] = await Promise.all([
    prisma.cashWithdrawal.findMany({ where: { voidedAt: null }, orderBy: { at: "desc" } }),
    prisma.purchaseInvoice.findMany({
      where: { voidedAt: null, paidBy: { not: null }, paymentMode: { in: PRESENTED_MODES } },
      orderBy: { invoiceDate: "desc" },
      select: { id: true, documentId: true, invoiceNo: true, invoiceDate: true, totalFils: true, paidBy: true, supplier: { select: { name: true } } },
    }),
  ]);
  const people = cashBalances(
    withdrawals.map((w) => ({ person: w.person, amountFils: w.amountFils })),
    invoices.map((i) => ({ person: i.paidBy!, amountFils: i.totalFils })),
  );
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
