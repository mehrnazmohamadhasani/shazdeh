"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Card, Field, Select, SwitchRow, TextArea, TextInput } from "@/components/admin/ui";
import { slugify } from "@/lib/utils";

type Cat = { id: string; name: string };

export type MenuItemDraft = {
  id?: string;
  slug: string;
  name: string;
  nameFa: string;
  description: string;
  price: number;
  imageUrl: string | null;
  categoryId: string;
  ingredients: string;
  allergens: string;
  isVegetarian: boolean;
  isAvailable: boolean;
  isActive: boolean;
};

const EMPTY: MenuItemDraft = {
  slug: "",
  name: "",
  nameFa: "",
  description: "",
  price: 0,
  imageUrl: null,
  categoryId: "",
  ingredients: "",
  allergens: "",
  isVegetarian: false,
  isAvailable: true,
  isActive: true,
};

export function MenuItemForm({ initial, categories }: { initial?: Partial<MenuItemDraft>; categories: Cat[] }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<MenuItemDraft>(() => ({
    ...EMPTY,
    categoryId: categories[0]?.id ?? "",
    ...initial,
  }));
  const [pending, setPending] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const isEditing = !!initial?.id;

  function update<K extends keyof MenuItemDraft>(key: K, value: MenuItemDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const { id: _id, ...rest } = draft;
      void _id;
      const payload = {
        ...rest,
        slug: draft.slug || slugify(draft.name),
        nameFa: draft.nameFa || null,
        description: draft.description || null,
        ingredients: draft.ingredients || null,
        allergens: draft.allergens || null,
      };
      const res = await fetch(isEditing ? `/api/menu-items/${initial!.id}` : "/api/menu-items", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Couldn't save the dish");
      }
      toast.success(isEditing ? "Dish saved" : "Dish created");
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
    if (!confirm(`Delete "${draft.name}"? This can't be undone. To take it off the menu temporarily, switch off "Shown on menu" instead.`)) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/menu-items/${initial!.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't delete the dish");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card title="Dish">
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <ImageUploader value={draft.imageUrl} onChange={(url) => update("imageUrl", url)} folder="menu" label="Photo" aspect="portrait" />
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <TextInput
                  value={draft.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setDraft((d) => ({
                      ...d,
                      name,
                      // Keep the web address in step with the name until it's been edited by hand.
                      slug: !isEditing && (!d.slug || d.slug === slugify(d.name)) ? slugify(name) : d.slug,
                    }));
                  }}
                  placeholder="e.g. Ghormeh Sabzi"
                  required
                />
              </Field>
              <Field label="Persian name">
                <TextInput value={draft.nameFa} onChange={(e) => update("nameFa", e.target.value)} placeholder="قورمه سبزی" lang="fa" dir="rtl" />
              </Field>
              <Field label="Category" required>
                <Select value={draft.categoryId} onChange={(e) => update("categoryId", e.target.value)} required>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Price (AED)" required>
                <TextInput
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min={0}
                  value={draft.price}
                  onChange={(e) => update("price", Number(e.target.value))}
                  required
                />
              </Field>
            </div>
            <Field label="Description" hint="One or two sentences shown on the menu.">
              <TextArea value={draft.description} onChange={(e) => update("description", e.target.value)} rows={3} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Ingredients & allergens" description="Dubai food rules expect allergens to be shown before ordering.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ingredients">
            <TextArea value={draft.ingredients} onChange={(e) => update("ingredients", e.target.value)} rows={3} placeholder="Lamb, kidney beans, parsley, fenugreek…" />
          </Field>
          <Field label="Allergens">
            <TextArea value={draft.allergens} onChange={(e) => update("allergens", e.target.value)} rows={3} placeholder="Contains: dairy, walnuts." />
          </Field>
        </div>
      </Card>

      <Card title="Availability">
        <div className="grid gap-3 sm:grid-cols-2">
          <SwitchRow label="Shown on menu" description="Off hides it everywhere." checked={draft.isActive} onCheckedChange={(v) => update("isActive", v)} />
          <SwitchRow label="In stock" description="Off shows it as sold out." checked={draft.isAvailable} onCheckedChange={(v) => update("isAvailable", v)} />
          <SwitchRow label="Vegetarian" checked={draft.isVegetarian} onCheckedChange={(v) => update("isVegetarian", v)} />
        </div>
        <details className="group mt-5 border-t border-black-iron/[0.06] pt-4">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-dark-grey hover:text-black-iron [&::-webkit-details-marker]:hidden">
            Advanced <span className="text-black-iron/40 group-open:hidden">· web address</span>
          </summary>
          <Field label="Web address" hint={`shazdeh.ae/menu/${draft.slug || slugify(draft.name) || "…"}`} className="mt-3 max-w-md">
            <TextInput value={draft.slug} onChange={(e) => update("slug", slugify(e.target.value))} placeholder={slugify(draft.name)} className="font-mono text-[13px]" />
          </Field>
        </details>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-black-iron/[0.07] bg-warm-white/95 px-4 py-3 pb-[max(0.75rem,var(--safe-bottom))] backdrop-blur sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
        {isEditing ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={removing} className="text-pomegranate-red hover:bg-pomegranate-red/[0.08]">
            <Trash2 className="h-4 w-4" />
            {removing ? "Deleting…" : "Delete dish"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? "Save changes" : "Create dish"}
          </Button>
        </div>
      </div>
    </form>
  );
}
