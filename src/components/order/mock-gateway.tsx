"use client";
import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function MockGateway({ token, number, amount, pending }: { token: string; number: string; amount: string; pending: boolean }) {
  const [busy, setBusy] = React.useState<"approve" | "decline" | null>(null);

  async function act(outcome: "approve" | "decline") {
    setBusy(outcome);
    await fetch("/api/payments/mock/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, outcome }),
    });
    window.location.assign(`/api/payments/mock/return?order=${token}`);
  }

  return (
    <div className="container-shazdeh max-w-md py-16">
      <div className="rounded-[18px] border-2 border-dashed border-saffron-orange bg-white p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-saffron-orange">Test gateway · development only</p>
        <h1 className="mt-3 text-[1.75rem] font-bold tracking-[-0.03em]">Pay {amount}</h1>
        <p className="mt-1 text-[14px] text-dark-grey">Order {number}. In production this is the payment provider&apos;s hosted page.</p>
        {pending ? (
          <div className="mt-6 grid gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("approve")}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-olive-leaf text-[13px] font-semibold text-white"
            >
              {busy === "approve" && <Loader2 className="h-4 w-4 animate-spin" />} Approve payment
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("decline")}
              className="flex h-12 items-center justify-center gap-2 rounded-full border border-rose-sumac text-[13px] font-semibold text-rose-sumac"
            >
              {busy === "decline" && <Loader2 className="h-4 w-4 animate-spin" />} Decline card
            </button>
            <Link href={`/order/checkout?cancelled=${token}`} className="mt-2 text-center text-[13px] text-dark-grey underline">
              Cancel and go back
            </Link>
          </div>
        ) : (
          <p className="mt-6 text-[14px]">This payment is no longer pending.</p>
        )}
      </div>
    </div>
  );
}
