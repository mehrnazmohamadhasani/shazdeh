"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save, X, Loader2 } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/admin/image-uploader";
import { slugify } from "@/lib/utils";

type Cat = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
  _count: { items: number };
};

type DraftCat = Omit<Cat, "id" | "_count"> & { id?: string };

const EMPTY: DraftCat = {
  slug: "",
  name: "",
  tagline: "",
  description: "",
  imageUrl: null,
  order: 0,
  isActive: true,
};

export function CategoriesManager({ initial }: { initial: Cat[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<DraftCat | null>(null);
  const [pending, setPending] = React.useState(false);

  async function save() {
    if (!editing) return;
    setPending(true);
    try {
      const payload = {
        ...editing,
        slug: editing.slug || slugify(editing.name),
        tagline: editing.tagline || null,
        description: editing.description || null,
      };
      const res = await fetch(
        editing.id ? `/api/categories/${editing.id}` : "/api/categories",
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
      toast.success(editing.id ? "Category updated" : "Category created");
      setEditing(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(c: Cat) {
    if (c._count.items > 0) {
      toast.error(
        `Move or delete the ${c._count.items} dishes in this category first.`,
      );
      return;
    }
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Category deleted");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY, order: initial.length })}>
          <Plus className="h-4 w-4" /> New category
        </Button>
      </div>

      <div className="rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] overflow-hidden">
        <div className="divide-y divide-warm-white/[0.06]">
          {initial.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                setEditing({
                  id: c.id,
                  slug: c.slug,
                  name: c.name,
                  tagline: c.tagline ?? "",
                  description: c.description ?? "",
                  imageUrl: c.imageUrl,
                  order: c.order,
                  isActive: c.isActive,
                })
              }
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-warm-white/[0.04] transition-colors"
            >
              <span className="font-mono text-warm-white/45 text-[11px] w-6 text-right tabular-nums">
                {c.order}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-warm-white text-[13px] font-medium truncate">
                  {c.name}
                </p>
                <p className="text-warm-white/55 text-[11px] truncate font-light">
                  {c.tagline ?? c.slug}
                </p>
              </div>
              <Badge variant={c.isActive ? "terracotta" : "outline"}>
                {c._count.items} dishes
              </Badge>
            </button>
          ))}
          {initial.length === 0 && (
            <div className="py-16 text-center">
              <p className="font-bold text-2xl tracking-[-0.03em] text-warm-white/70">
                No categories yet.
              </p>
              <p className="mt-2 text-warm-white/50 text-[13px] font-light">
                Create your first category to start adding dishes.
              </p>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <CategoryDrawer
          draft={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={
            editing.id
              ? () => {
                  const cat = initial.find((c) => c.id === editing.id);
                  if (cat) remove(cat);
                }
              : undefined
          }
          pending={pending}
        />
      )}
    </div>
  );
}

function CategoryDrawer({
  draft,
  onChange,
  onClose,
  onSave,
  onDelete,
  pending,
}: {
  draft: DraftCat;
  onChange: (c: DraftCat) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black-iron/70 backdrop-blur-md">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-lg bg-black-iron border-l border-warm-white/[0.08] overflow-y-auto">
        <div className="sticky top-0 bg-black-iron/95 backdrop-blur-xl border-b border-warm-white/[0.08] px-7 py-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
              {draft.id ? "Edit" : "New"}
            </p>
            <h3 className="mt-3 font-bold text-2xl text-warm-white tracking-[-0.035em]">
              Category
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
            value={draft.imageUrl}
            onChange={(url) => onChange({ ...draft, imageUrl: url })}
            folder="categories"
            label="Cover image"
            aspect="video"
          />

          <Field label="Name" required>
            <Input
              value={draft.name}
              onChange={(e) => {
                const name = e.target.value;
                onChange({
                  ...draft,
                  name,
                  slug:
                    !draft.id && (!draft.slug || draft.slug === slugify(draft.name))
                      ? slugify(name)
                      : draft.slug,
                });
              }}
              required
              placeholder="Main Dishes"
            />
          </Field>

          <Field label="Slug" required>
            <Input
              value={draft.slug}
              onChange={(e) =>
                onChange({ ...draft, slug: slugify(e.target.value) })
              }
              required
              className="font-mono text-xs"
              placeholder="mains"
            />
          </Field>

          <Field label="Tagline">
            <Input
              value={draft.tagline ?? ""}
              onChange={(e) => onChange({ ...draft, tagline: e.target.value })}
              placeholder="The heart of the table"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) =>
                onChange({ ...draft, description: e.target.value })
              }
              rows={3}
              placeholder="A short editorial intro to the section."
            />
          </Field>

          <div className="grid grid-cols-2 gap-5">
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
            <label className="flex items-end gap-3 pb-2.5">
              <Switch
                checked={draft.isActive}
                onCheckedChange={(v) => onChange({ ...draft, isActive: v })}
              />
              <span className="text-[13px] text-warm-white font-light">
                Active
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-4">
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                className="text-pomegranate-red hover:bg-pomegranate-red/[0.10]"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
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
