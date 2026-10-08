"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Card, Field, TextArea, TextInput } from "@/components/admin/ui";

const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;

type Settings = {
  brandName: string;
  description: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
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
      const empty = (v: string) => v.trim() || null;
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          description: empty(draft.description),
          email: empty(draft.email),
          phone: empty(draft.phone),
          whatsapp: empty(draft.whatsapp),
          address: empty(draft.address),
          openingHours: draft.openingHours || null,
          metaTitle: empty(draft.metaTitle),
          metaDesc: empty(draft.metaDesc),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Couldn't save");
      }
      toast.success("Saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card title="Contact" description="Shown in the website footer and used for order help.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" required>
            <TextInput value={draft.brandName} onChange={(e) => update("brandName", e.target.value)} required />
          </Field>
          <Field label="Phone">
            <TextInput value={draft.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+971 4 000 0000" inputMode="tel" />
          </Field>
          <Field label="WhatsApp number" hint="Digits only, with country code.">
            <TextInput value={draft.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="971500000000" inputMode="tel" />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={draft.email} onChange={(e) => update("email", e.target.value)} placeholder="hello@shazdeh.ae" />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <TextInput value={draft.address} onChange={(e) => update("address", e.target.value)} placeholder="Dubai, United Arab Emirates" />
          </Field>
        </div>
      </Card>

      <Card title="Opening hours" description="Leave a day empty if you're closed.">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {DAYS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[13px] text-dark-grey">{label}</span>
              <TextInput value={hours[key] ?? ""} onChange={(e) => setHour(key, e.target.value)} placeholder="12:00 — 23:00" aria-label={`${label} hours`} />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Logo & sharing image">
        <div className="grid gap-6 sm:grid-cols-2">
          <ImageUploader value={draft.logoUrl} onChange={(url) => update("logoUrl", url)} folder="brand" label="Logo (optional)" aspect="video" />
          <ImageUploader value={draft.ogImageUrl} onChange={(url) => update("ogImageUrl", url)} folder="brand" label="Image when the site is shared" aspect="video" />
        </div>
      </Card>

      <Card title="Search engines" description="How SHĀZDEH appears on Google.">
        <div className="space-y-4">
          <Field label="Page title">
            <TextInput value={draft.metaTitle} onChange={(e) => update("metaTitle", e.target.value)} placeholder="SHĀZDEH — Persian Cuisine · Dubai" maxLength={70} />
          </Field>
          <Field label="Description" hint={`${draft.metaDesc.length}/160`}>
            <TextArea value={draft.metaDesc} onChange={(e) => update("metaDesc", e.target.value)} rows={2} maxLength={180} />
          </Field>
          <Field label="About the business" hint="Used in Google's business summary.">
            <TextArea value={draft.description} onChange={(e) => update("description", e.target.value)} rows={3} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}
