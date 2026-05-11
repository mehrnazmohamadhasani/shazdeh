"use client";
import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save, X, Loader2 } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/admin/image-uploader";

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string;
  position: string;
  order: number;
  isActive: boolean;
};

type Draft = Omit<Banner, "id"> & { id?: string };

const POSITIONS = [
  { id: "home_hero", label: "Home — Hero" },
  { id: "home_secondary", label: "Home — Secondary" },
  { id: "menu_hero", label: "Menu — Hero" },
];

const EMPTY: Draft = {
  title: "",
  subtitle: "",
  ctaLabel: "",
  ctaHref: "",
  imageUrl: "",
  position: "home_hero",
  order: 0,
  isActive: true,
};

export function BannersManager({ initial }: { initial: Banner[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [pending, setPending] = React.useState(false);

  async function save() {
    if (!editing) return;
    if (!editing.imageUrl) {
      toast.error("Please upload an image first.");
      return;
    }
    setPending(true);
    try {
      const payload = {
        ...editing,
        subtitle: editing.subtitle || null,
        ctaLabel: editing.ctaLabel || null,
        ctaHref: editing.ctaHref || null,
      };
      const res = await fetch(
        editing.id ? `/api/banners/${editing.id}` : "/api/banners",
        {
          method: editing.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to save");
      }
      toast.success(editing.id ? "Banner updated" : "Banner created");
      setEditing(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(b: Banner) {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    try {
      const res = await fetch(`/api/banners/${b.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Banner deleted");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="h-4 w-4" /> New banner
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {initial.map((b) => (
          <div
            key={b.id}
            className="group relative overflow-hidden rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02]"
          >
            <div className="relative aspect-[16/9] bg-black-iron">
              {b.imageUrl && (
                <Image
                  src={b.imageUrl}
                  alt={b.title}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black-iron/95 via-black-iron/30 to-transparent" />
              <div className="absolute top-3 left-3 flex gap-1.5">
                <Badge variant={b.isActive ? "terracotta" : "outline"}>
                  {b.isActive ? "Live" : "Hidden"}
                </Badge>
                <Badge variant="outline">{prettyPos(b.position)}</Badge>
              </div>
              <div className="absolute bottom-3 left-4 right-4">
                <p className="font-bold text-warm-white text-xl tracking-[-0.03em] leading-tight line-clamp-2">
                  {b.title}
                </p>
                {b.subtitle && (
                  <p className="text-warm-white/65 text-[11px] mt-1 line-clamp-1 font-light">
                    {b.subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 p-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setEditing({
                    id: b.id,
                    title: b.title,
                    subtitle: b.subtitle ?? "",
                    ctaLabel: b.ctaLabel ?? "",
                    ctaHref: b.ctaHref ?? "",
                    imageUrl: b.imageUrl,
                    position: b.position,
                    order: b.order,
                    isActive: b.isActive,
                  })
                }
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(b)}
                className="text-pomegranate-red hover:bg-pomegranate-red/[0.10]"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Delete
              </Button>
            </div>
          </div>
        ))}
        {initial.length === 0 && (
          <div className="md:col-span-2 py-16 text-center rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02]">
            <p className="font-bold text-2xl tracking-[-0.03em] text-warm-white/70">
              No banners yet.
            </p>
            <p className="mt-2 text-warm-white/50 text-[13px] font-light">
              Add a hero image to anchor the home page.
            </p>
          </div>
        )}
      </div>

      {editing && (
        <BannerDrawer
          draft={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
          pending={pending}
        />
      )}
    </div>
  );
}

function prettyPos(p: string) {
  const found = POSITIONS.find((x) => x.id === p);
  return found?.label ?? p;
}

function BannerDrawer({
  draft,
  onChange,
  onClose,
  onSave,
  pending,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black-iron/70 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg bg-black-iron border-l border-warm-white/[0.08] overflow-y-auto">
        <div className="sticky top-0 bg-black-iron/95 backdrop-blur-xl border-b border-warm-white/[0.08] px-7 py-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
              {draft.id ? "Edit" : "New"}
            </p>
            <h3 className="mt-3 font-bold text-2xl text-warm-white tracking-[-0.035em]">
              Banner
            </h3>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full text-warm-white/55 hover:text-warm-white hover:bg-warm-white/[0.06]"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          className="p-7 space-y-5"
        >
          <ImageUploader
            value={draft.imageUrl || null}
            onChange={(url) => onChange({ ...draft, imageUrl: url ?? "" })}
            folder="banners"
            label="Banner image"
            aspect="video"
          />

          <Field label="Title" required>
            <Input
              value={draft.title}
              onChange={(e) => onChange({ ...draft, title: e.target.value })}
              required
              placeholder="A Persian Kitchen, Reimagined."
            />
          </Field>

          <Field label="Subtitle">
            <Textarea
              value={draft.subtitle ?? ""}
              onChange={(e) =>
                onChange({ ...draft, subtitle: e.target.value })
              }
              rows={2}
              placeholder="Slow-cooked Iranian heritage. Plated for the new Dubai table."
            />
          </Field>

          <div className="grid grid-cols-2 gap-5">
            <Field label="CTA label">
              <Input
                value={draft.ctaLabel ?? ""}
                onChange={(e) =>
                  onChange({ ...draft, ctaLabel: e.target.value })
                }
                placeholder="View the menu"
              />
            </Field>
            <Field label="CTA link">
              <Input
                value={draft.ctaHref ?? ""}
                onChange={(e) =>
                  onChange({ ...draft, ctaHref: e.target.value })
                }
                placeholder="/menu"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Field label="Position">
              <select
                value={draft.position}
                onChange={(e) =>
                  onChange({ ...draft, position: e.target.value })
                }
                className="flex h-11 w-full rounded-md border border-warm-white/10 bg-black-iron/60 px-3 text-[13px] font-light text-warm-white focus:outline-none focus:ring-1 focus:ring-terracotta/40"
              >
                {POSITIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sort order">
              <Input
                type="number"
                min={0}
                value={draft.order}
                onChange={(e) =>
                  onChange({ ...draft, order: Number(e.target.value) })
                }
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 px-3 py-2 rounded-md">
            <Switch
              checked={draft.isActive}
              onCheckedChange={(v) => onChange({ ...draft, isActive: v })}
            />
            <span className="text-[13px] text-warm-white font-light">
              Live on the website
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
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
