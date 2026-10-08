import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { WhatsappIcon } from "@/components/icons/social";
import { telHref } from "@/lib/links";

/*
 * Ordering shell. Deliberately quieter than the marketing site: a slim
 * header that says "this is SHĀZDEH's own ordering", one help action,
 * and a legal footer. No video, no big type, nothing between the
 * customer and their basket.
 */
export function OrderHeader({
  logoUrl,
  whatsapp,
  phone,
}: {
  logoUrl: string | null;
  whatsapp?: string;
  phone: string | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-black-iron/[0.07] bg-warm-white/95 backdrop-blur">
      <div className="container-shazdeh flex h-[60px] items-center justify-between gap-4 md:h-[68px]">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Back to SHĀZDEH home"
            className="-ml-2 grid h-11 w-11 place-items-center rounded-full hover:bg-black-iron/[0.05] md:hidden"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </Link>
          <Link href="/order" aria-label="SHĀZDEH — order online" className="flex items-center gap-3">
            <Wordmark size="sm" logoUrl={logoUrl} />
            <span className="hidden h-5 w-px bg-black-iron/15 sm:block" aria-hidden />
            <span className="hidden text-[10.5px] font-medium uppercase tracking-[0.22em] text-terracotta-ink sm:block">
              Order direct
            </span>
          </Link>
        </div>
        <nav aria-label="Ordering" className="flex items-center gap-1">
          <Link
            href="/menu"
            className="hidden min-h-11 items-center px-3 text-[11px] font-medium uppercase tracking-[0.2em] text-black-iron/70 hover:text-black-iron md:inline-flex"
          >
            Our story & menu
          </Link>
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black-iron/15 px-4 text-[12px] font-medium hover:border-black-iron/40"
            >
              <WhatsappIcon className="h-4 w-4" />
              Help
            </a>
          ) : phone ? (
            <a
              href={telHref(phone)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black-iron/15 px-4 text-[12px] font-medium"
            >
              <Phone className="h-4 w-4" strokeWidth={1.5} />
              Help
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function OrderFooter({
  brandName,
  legal,
  address,
  email,
  phone,
}: {
  brandName: string;
  legal: { legalName: string | null; tradeLicenseNo: string | null; licensingAuthority: string | null; trn: string | null };
  address: string | null;
  email: string | null;
  phone: string | null;
}) {
  return (
    <footer className="border-t border-black-iron/[0.07] bg-cream/60">
      <div className="container-shazdeh grid gap-6 py-8 text-[12px] leading-[1.7] text-dark-grey md:grid-cols-2">
        <div>
          <p className="font-medium text-black-iron">
            {legal.legalName ?? brandName} · Direct ordering — no marketplace in between.
          </p>
          <p>
            {[
              address,
              legal.tradeLicenseNo && `Trade licence ${legal.tradeLicenseNo}${legal.licensingAuthority ? ` (${legal.licensingAuthority})` : ""}`,
              legal.trn && `TRN ${legal.trn}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p>{[email, phone].filter(Boolean).join(" · ")}</p>
        </div>
        <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-1 md:justify-end">
          <Link href="/legal/terms" className="min-h-11 content-center hover:text-black-iron">Terms</Link>
          <Link href="/legal/privacy" className="min-h-11 content-center hover:text-black-iron">Privacy</Link>
          <Link href="/legal/refunds" className="min-h-11 content-center hover:text-black-iron">Cancellations & refunds</Link>
          <Link href="/legal/delivery" className="min-h-11 content-center hover:text-black-iron">Delivery</Link>
          <Link href="/order/apps" className="min-h-11 content-center hover:text-black-iron">Delivery apps</Link>
        </nav>
      </div>
    </footer>
  );
}
