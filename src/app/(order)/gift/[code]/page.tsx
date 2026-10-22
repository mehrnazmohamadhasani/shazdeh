import type { Metadata } from "next";
import Link from "next/link";
import { Gift } from "lucide-react";
import { GiftClaimForm } from "@/components/order/gift-claim-form";
import { findGiftOffer } from "@/lib/ordering/gifts";
import { formatGiftDate } from "@/lib/ordering/gift-utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your gift",
  robots: { index: false, follow: false },
};

/** Where the printed QR lands: the offer, and a short form to claim it. */
export default async function GiftPage({ params }: { params: Promise<{ code: string }> }) {
  const gift = await findGiftOffer((await params).code);
  return (
    <section className="mx-auto max-w-md px-5 pb-16 pt-10">
      {gift ? (
        <>
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
              <Gift className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-terracotta">A gift from SHĀZDEH</p>
            <h1 className="mt-2 text-[2.5rem] font-bold leading-none tracking-[-0.04em]">{gift.offer}</h1>
            <p className="mt-2 text-[15px] text-dark-grey">your next order on our website</p>
            {gift.note && <p className="mt-3 text-[14px]">{gift.note}</p>}
            <p className="mt-3 text-[12.5px] text-dark-grey">
              {[
                gift.minSubtotal > 0 ? `Minimum order AED ${gift.minSubtotal}` : null,
                gift.endsAt ? `Valid until ${formatGiftDate(gift.endsAt)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <GiftClaimForm code={gift.code} offer={gift.offer} />
        </>
      ) : (
        <div className="text-center">
          <h1 className="text-[2rem] font-bold tracking-[-0.04em]">This gift has ended</h1>
          <p className="mt-3 text-[15px] text-dark-grey">Thank you for scanning — you can still order SHĀZDEH directly from our kitchen.</p>
          <Link href="/order" className="mt-6 inline-flex h-12 items-center rounded-pill bg-terracotta px-6 text-[14px] font-semibold text-warm-white">
            See the menu
          </Link>
        </div>
      )}
    </section>
  );
}
