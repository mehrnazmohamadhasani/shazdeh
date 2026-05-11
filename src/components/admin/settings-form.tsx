"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/image-uploader";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type Settings = {
  brandName: string;
  tagline: string;
  description: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  mapUrl: string;
  openingHours: string;
  logoUrl: string | null;
  ogImageUrl: string | null;
  metaTitle: string;
  metaDesc: string;
};

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(initial);
  const [pending, setPending] = React.useState(false);

  const hours = React.useMemo(() => {
    try {
      return JSON.parse(draft.openingHours || "{}") as Record<string, string>;
    } catch {
      return {};
    }
  }, [draft.openingHours]);

  function setHour(day: string, value: string) {
    const next = { ...hours, [day]: value };
    setDraft((d) => ({ ...d, openingHours: JSON.stringify(next) }));
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const payload = {
        ...draft,
        // empty → null
        tagline: draft.tagline || null,
        description: draft.description || null,
        email: draft.email || null,
        phone: draft.phone || null,
        whatsapp: draft.whatsapp || null,
        address: draft.address || null,
        mapUrl: draft.mapUrl || null,
        openingHours: draft.openingHours || null,
        metaTitle: draft.metaTitle || null,
        metaDesc: draft.metaDesc || null,
      };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to save");
      }
      toast.success("Settings saved");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-10">
      <Section
        eyebrow="Identity"
        title="Brand identity"
        description="Used everywhere — page titles, footer, OG cards."
      >
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Brand name" required>
            <Input
              value={draft.brandName}
              onChange={(e) => update("brandName", e.target.value)}
              required
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={draft.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="Persian Cuisine"
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
            rows={4}
          />
        </Field>
      </Section>

      <Section
        eyebrow="Contact"
        title="How customers reach you"
      >
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Email">
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="hello@shazdeh.ae"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={draft.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+971 4 000 0000"
            />
          </Field>
          <Field label="WhatsApp number">
            <Input
              value={draft.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
              placeholder="971500000000"
              className="font-mono"
            />
          </Field>
          <Field label="Address">
            <Input
              value={draft.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Dubai, United Arab Emirates"
            />
          </Field>
        </div>
        <Field label="Google Maps URL">
          <Input
            value={draft.mapUrl}
            onChange={(e) => update("mapUrl", e.target.value)}
            placeholder="https://maps.google.com/?q=..."
            className="font-mono text-xs"
          />
        </Field>
      </Section>

      <Section
        eyebrow="Hours"
        title="Opening hours"
        description="Used on the contact page."
      >
        <div className="grid sm:grid-cols-2 gap-3">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-3">
              <span className="w-12 text-warm-white/55 text-[10px] tracking-[0.22em] uppercase font-medium">
                {day}
              </span>
              <Input
                value={hours[day] ?? ""}
                onChange={(e) => setHour(day, e.target.value)}
                placeholder="12:00 — 23:00"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Brand assets"
        title="Logo & OG image"
        description="The logo shown in the admin sidebar and the social card image."
      >
        <div className="grid sm:grid-cols-2 gap-6">
          <ImageUploader
            value={draft.logoUrl}
            onChange={(url) => update("logoUrl", url)}
            folder="brand"
            label="Logo"
            aspect="square"
          />
          <ImageUploader
            value={draft.ogImageUrl}
            onChange={(url) => update("ogImageUrl", url)}
            folder="brand"
            label="OG / share image"
            aspect="video"
          />
        </div>
      </Section>

      <Section
        eyebrow="SEO"
        title="Search engine basics"
      >
        <Field label="Meta title">
          <Input
            value={draft.metaTitle}
            onChange={(e) => update("metaTitle", e.target.value)}
            placeholder="SHĀZDEH — Persian Cuisine · Dubai"
            maxLength={70}
          />
        </Field>
        <Field label="Meta description">
          <Textarea
            value={draft.metaDesc}
            onChange={(e) => update("metaDesc", e.target.value)}
            rows={3}
            maxLength={180}
          />
        </Field>
      </Section>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending} size="lg">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save settings
        </Button>
      </div>
    </form>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] p-7 md:p-8 space-y-5">
      <header>
        <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
          {eyebrow}
        </p>
        <h2 className="mt-3 font-bold text-2xl text-warm-white tracking-[-0.035em]">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-warm-white/55 text-[13px] font-light">
            {description}
          </p>
        )}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-terracotta ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}
