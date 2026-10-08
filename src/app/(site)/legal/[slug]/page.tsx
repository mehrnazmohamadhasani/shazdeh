import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getOrderingSettings } from "@/lib/ordering/config";
import { LEGAL_SLUGS, legalDoc, type LegalSlug } from "@/lib/legal";

export const revalidate = 3600;

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

function isSlug(s: string): s is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(s);
}

async function context() {
  const [site, ordering] = await Promise.all([getSettings(), getOrderingSettings()]);
  return {
    brand: site.brandName,
    legalName: ordering.legalName ?? "[legal business name]",
    licence: ordering.tradeLicenseNo ?? "[trade licence no.]",
    authority: ordering.licensingAuthority ?? "[licensing authority]",
    trn: ordering.trn,
    address: site.address ?? "Dubai, United Arab Emirates",
    email: site.email ?? "[email]",
    phone: site.phone ?? "[phone]",
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isSlug(slug)) return {};
  const doc = legalDoc(slug, await context());
  return { title: doc.title, alternates: { canonical: `/legal/${slug}` } };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const doc = legalDoc(slug, await context());
  const reviewed = process.env.LEGAL_REVIEWED === "true";
  return (
    <article className="container-shazdeh max-w-3xl pb-24 pt-32 md:pt-40">
      {!reviewed && (
        <p role="note" className="mb-8 rounded-[12px] border border-saffron-orange/40 bg-saffron-orange/10 px-4 py-3 text-[13px] text-cinnamon-bark">
          This policy is being finalised and will be published in Arabic and English.
        </p>
      )}
      <p className="eyebrow eyebrow-accent">Policies</p>
      <h1 className="t-h2 mt-4">{doc.title}</h1>
      <p className="t-lead mt-6 text-dark-grey">{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.heading} className="mt-10">
          <h2 className="t-h3">{s.heading}</h2>
          {s.body.map((p) => (
            <p key={p.slice(0, 40)} className="t-body mt-3 text-black-iron/85">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
