import type { Metadata } from "next";
import Link from "next/link";
import { Gift, MessageCircle } from "lucide-react";
import { openGiftLink } from "@/lib/ordering/gifts";
import { formatGiftDate } from "@/lib/ordering/gift-utils";
import { maskPhone } from "@/lib/ordering/phone";
import { getSettings } from "@/lib/settings";
import { findPlatform, getSocialLinks } from "@/lib/social";
import { whatsappHref } from "@/lib/links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your gift",
  robots: { index: false, follow: false },
};

/** The link in the gift email: what the customer got, and a way to order. */
export default async function ActivateGiftPage({ params }: { params: Promise<{ token: string }> }) {
  const gift = await openGiftLink((await params).token);
  if (!gift) {
    return (
      <Message title="This link doesn't work" body="It may have been copied incompletely. Scan the QR card again to get a new email." />
    );
  }
  if (gift.used) return <Message title="You've used this gift" body="Thank you for ordering with SHĀZDEH — nooshe jan!" />;
  if (gift.ended) return <Message title="This gift has ended" body="Thank you — you can still order SHĀZDEH directly from our kitchen." />;

  const [settings, socials] = await Promise.all([getSettings(), getSocialLinks()]);
  // Free "save it" option: the customer sends it to our WhatsApp, so it stays in their chat.
  const whatsapp = whatsappHref(
    settings.whatsapp ?? findPlatform(socials, "whatsapp")?.url,
    `Hi SHĀZDEH! I have a gift: ${gift.offer} on my next website order (${gift.code}).`,
  );
  return (
    <section className="mx-auto max-w-md px-5 pb-16 pt-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-olive-leaf/10 text-olive-leaf">
        <Gift className="h-7 w-7" strokeWidth={1.75} />
      </span>
      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-olive-leaf">Your gift is ready</p>
      <h1 className="mt-2 text-[2.5rem] font-bold leading-none tracking-[-0.04em]">{gift.offer}</h1>
      <p className="mt-3 text-[15px] text-dark-grey">
        {gift.name ? `${gift.name}, it` : "It"}&apos;s applied by itself at checkout when you order with{" "}
        <strong className="whitespace-nowrap text-black-iron">{maskPhone(gift.phone)}</strong>.
      </p>
      {gift.note && <p className="mt-2 text-[14px]">{gift.note}</p>}
      <p className="mt-3 text-[12.5px] text-dark-grey">
        {[gift.minSubtotal > 0 ? `Minimum order AED ${gift.minSubtotal}` : null, gift.endsAt ? `Valid until ${formatGiftDate(gift.endsAt)}` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link href="/order" className="flex h-12 items-center justify-center rounded-pill bg-terracotta text-[14px] font-semibold text-warm-white">
          Order now
        </Link>
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-pill border border-black-iron/80 text-[14px] font-semibold"
          >
            <MessageCircle className="h-4 w-4" /> Save it in WhatsApp
          </a>
        )}
      </div>
    </section>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <section className="mx-auto max-w-md px-5 pb-16 pt-14 text-center">
      <h1 className="text-[2rem] font-bold tracking-[-0.04em]">{title}</h1>
      <p className="mt-3 text-[15px] text-dark-grey">{body}</p>
      <Link href="/order" className="mt-6 inline-flex h-12 items-center rounded-pill bg-terracotta px-6 text-[14px] font-semibold text-warm-white">
        See the menu
      </Link>
    </section>
  );
}
