"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/admin/image-uploader";
import { slugify } from "@/lib/utils";

type Cat = { id: string; name: string };

export type MenuItemDraft = {
  id?: string;
  slug: string;
  name: string;
  nameFa: string;
  description: string;
  story: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  categoryId: string;
  ingredients: string;
  allergens: string;
  spicyLevel: number;
  isVegetarian: boolean;
  isAvailable: boolean;
  isBestseller: boolean;
  isNew: boolean;
  isSignature: boolean;
  order: number;
};

const EMPTY: MenuItemDraft = {
  slug: "",
  name: "",
  nameFa: "",
  description: "",
  story: "",
  price: 0,
  currency: "AED",
  imageUrl: null,
  categoryId: "",
  ingredients: "",
  allergens: "",
  spicyLevel: 0,
  isVegetarian: false,
  isAvailable: true,
  isBestseller: false,
  isNew: false,
  isSignature: false,
  order: 0,
};

export function MenuItemForm({
  initial,
  categories,
}: {
  initial?: Partial<MenuItemDraft>;
  categories: Cat[];
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<MenuItemDraft>(() => ({
    ...EMPTY,
    categoryId: categories[0]?.id ?? "",
    ...initial,
  }));
  const [pending, setPending] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  const isEditing = !!initial?.id;

  function update<K extends keyof MenuItemDraft>(
    key: K,
    value: MenuItemDraft[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const payload = {
        ...draft,
        slug: draft.slug || slugify(draft.name),
        nameFa: draft.nameFa || null,
        description: draft.description || null,
        story: draft.story || null,
        ingredients: draft.ingredients || null,
        allergens: draft.allergens || null,
      };
      const res = await fetch(
        isEditing ? `/api/menu-items/${initial!.id}` : "/api/menu-items",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to save");
      }
      toast.success(isEditing ? "Dish updated" : "Dish created");
      router.push("/admin/menu-items");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!isEditing) return;
    if (!confirm(`Delete "${draft.name}"? This cannot be undone.`)) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/menu-items/${initial!.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Dish deleted");
      router.push("/admin/menu-items");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <ImageUploader
            value={draft.imageUrl}
            onChange={(url) => update("imageUrl", url)}
            folder="menu"
            label="Hero image"
            aspect="portrait"
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Field label="Name (English)" required>
            <Input
              value={draft.name}
              onChange={(e) => {
                const name = e.target.value;
                update("name", name);
                if (!isEditing && (!draft.slug || draft.slug === slugify(draft.name))) {
                  update("slug", slugify(name));
                }
              }}
              placeholder="e.g. Ghormeh Sabzi"
              required
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Persian name">
              <Input
                value={draft.nameFa}
                onChange={(e) => update("nameFa", e.target.value)}
                placeholder="قورمه سبزی"
                lang="fa"
                dir="rtl"
              />
            </Field>
            <Field label="Slug" required>
              <Input
                value={draft.slug}
                onChange={(e) => update("slug", slugify(e.target.value))}
                placeholder="ghormeh-sabzi"
                required
                className="font-mono text-xs"
              />
            </Field>
          </div>

          <Field label="Short description">
            <Textarea
              value={draft.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              placeholder="One sentence to get the dish across."
            />
          </Field>

          <Field label="Story / chef notes">
            <Textarea
              value={draft.story}
              onChange={(e) => update("story", e.target.value)}
              rows={3}
              placeholder="An optional longer note about provenance or technique."
            />
          </Field>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Price" required>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={draft.price}
                onChange={(e) => update("price", Number(e.target.value))}
                required
              />
            </Field>
            <Field label="Currency">
              <Input
                value={draft.currency}
                onChange={(e) =>
                  update("currency", e.target.value.toUpperCase())
                }
                maxLength={4}
                className="font-mono uppercase"
              />
            </Field>
            <Field label="Category" required>
              <select
                value={draft.categoryId}
                onChange={(e) => update("categoryId", e.target.value)}
                required
                className="flex h-11 w-full rounded-md border border-warm-white/10 bg-black-iron/60 px-3 text-[13px] font-light text-warm-white focus:outline-none focus:ring-1 focus:ring-terracotta/40 focus:border-terracotta/60"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sort order">
              <Input
                type="number"
                inputMode="numeric"
                step="1"
                min={0}
                value={draft.order}
                onChange={(e) => update("order", Number(e.target.value))}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Ingredients">
              <Textarea
                value={draft.ingredients}
                onChange={(e) => update("ingredients", e.target.value)}
                rows={2}
                placeholder="Lamb, kidney beans, parsley, fenugreek…"
              />
            </Field>
            <Field label="Allergens">
              <Textarea
                value={draft.allergens}
                onChange={(e) => update("allergens", e.target.value)}
                rows={2}
                placeholder="Contains: dairy, walnuts."
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] p-7">
        <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
          Flags
        </p>
        <h3 className="mt-3 font-bold text-2xl text-warm-white tracking-[-0.035em]">
          Storefront markers
        </h3>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Toggle
            label="Available"
            description="Customers can order this dish"
            checked={draft.isAvailable}
            onChange={(v) => update("isAvailable", v)}
          />
          <Toggle
            label="Signature"
            description="Highest priority in carousels"
            checked={draft.isSignature}
            onChange={(v) => update("isSignature", v)}
          />
          <Toggle
            label="Bestseller"
            description="Tagged on cards and lists"
            checked={draft.isBestseller}
            onChange={(v) => update("isBestseller", v)}
          />
          <Toggle
            label="New"
            description="Highlighted as a recent addition"
            checked={draft.isNew}
            onChange={(v) => update("isNew", v)}
          />
          <Toggle
            label="Vegetarian"
            description="Plant-based — no meat or fish"
            checked={draft.isVegetarian}
            onChange={(v) => update("isVegetarian", v)}
          />
          <Field label="Spicy level" className="!space-y-2">
            <select
              value={draft.spicyLevel}
              onChange={(e) => update("spicyLevel", Number(e.target.value))}
              className="flex h-11 w-full rounded-md border border-warm-white/10 bg-black-iron/60 px-3 text-[13px] font-light text-warm-white focus:outline-none focus:ring-1 focus:ring-terracotta/40"
            >
              <option value={0}>None</option>
              <option value={1}>Mild</option>
              <option value={2}>Medium</option>
              <option value={3}>Hot</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {isEditing ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            disabled={removing}
            className="text-pomegranate-red hover:bg-pomegranate-red/[0.10]"
          >
            <Trash2 className="h-4 w-4" />
            {removing ? "Deleting…" : "Delete"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? "Save changes" : "Create dish"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>
        {label}
        {required && <span className="text-terracotta ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-3.5 rounded-md border border-warm-white/[0.06] bg-black-iron/40 cursor-pointer hover:border-warm-white/15 transition-colors">
      <Switch checked={checked} onCheckedChange={onChange} />
      <div className="min-w-0">
        <p className="text-warm-white text-[13px] font-medium leading-tight">
          {label}
        </p>
        {description && (
          <p className="text-warm-white/55 text-[11px] mt-1 leading-snug font-light">
            {description}
          </p>
        )}
      </div>
    </label>
  );
}
