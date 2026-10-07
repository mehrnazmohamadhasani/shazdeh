import { ArrowUpRight } from "lucide-react";
import { ArchLines } from "@/components/brand/arch";
import { WhatsappIcon } from "@/components/icons/social";
import { Reveal } from "@/components/shared/reveal";
import type { SocialLinkView } from "@/lib/social";

/*
 * Order band — the closing invitation on the brand terracotta (an
 * approved "accent background" application). SHĀZDEH is delivery-only,
 * so the page ends on the one action that matters.
 */
export function OrderBand({
  partners,
  whatsapp,
}: {
  partners: SocialLinkView[];
  whatsapp?: string;
}) {
  if (partners.length === 0 && !whatsapp) return null;

  return (
    <section
      aria-labelledby="order-band-heading"
      className="relative overflow-hidden bg-terracotta text-white"
    >
      <ArchLines
        count={3}
        gap={18}
        className="absolute -bottom-24 right-[-8%] hidden h-[130%] w-[42%] text-white/[0.16] md:block"
      />
      <div className="container-shazdeh section relative">
        <Reveal>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/80">
            Now delivering across Dubai
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 id="order-band-heading" className="t-h1 mt-5 max-w-3xl">
            Bring the Persian table home tonight.
          </h2>
        </Reveal>
        <Reveal delay={0.14}>
          <ul className="mt-12 flex flex-wrap gap-3">
            {partners.map((p) => (
              <li key={p.id}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex h-14 items-center gap-3 rounded-pill bg-warm-white px-7 text-[12px] font-medium uppercase tracking-[0.2em] text-black-iron transition-colors duration-500 hover:bg-white"
                >
                  {p.label}
                  <ArrowUpRight
                    aria-hidden
                    className="h-4 w-4 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    strokeWidth={1.5}
                  />
                </a>
              </li>
            ))}
            {whatsapp && (
              <li>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-14 items-center gap-3 rounded-pill border border-white/55 px-7 text-[12px] font-medium uppercase tracking-[0.2em] transition-colors duration-500 hover:border-white hover:bg-white/10"
                >
                  <WhatsappIcon className="h-4 w-4" />
                  WhatsApp the kitchen
                </a>
              </li>
            )}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
