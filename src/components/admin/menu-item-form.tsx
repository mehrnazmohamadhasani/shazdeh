"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Card, Field, Select, SwitchRow, TextArea, TextInput, chipButtonClass } from "@/components/admin/ui";
import { cn, slugify } from "@/lib/utils";
import { useAdminI18n } from "@/components/admin/i18n";
import type { Translate } from "@/lib/admin-i18n";

type Cat = { id: string; name: string };

/**
 * API errors in the admin language. Validation errors arrive as
 * "field: message"; in Persian the field path is dropped and the message
 * translated (or a general "check your input" when there's no entry).
 */
function apiErrorText(msg: string, t: Translate, fa: boolean) {
  const m = fa ? /^[\w.]+: (.+)$/.exec(msg) : null;
  if (!m) return t(msg);
  const text = t(m[1]);
  return text !== m[1] ? text : t("Validation failed");
}

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
  nameAr: string;
  descriptionAr: string;
  ingredientsAr: string;
  allergensAr: string;
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
  nameAr: "",
  descriptionAr: "",
  ingredientsAr: "",
  allergensAr: "",
  isVegetarian: false,
  isAvailable: true,
  isActive: true,
};

export function MenuItemForm({ initial, categories }: { initial?: Partial<MenuItemDraft>; categories: Cat[] }) {
  const router = useRouter();
  const { t, locale } = useAdminI18n();
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
        nameAr: draft.nameAr || null,
        descriptionAr: draft.descriptionAr || null,
        ingredientsAr: draft.ingredientsAr || null,
        allergensAr: draft.allergensAr || null,
      };
      const res = await fetch(isEditing ? `/api/menu-items/${initial!.id}` : "/api/menu-items", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ? apiErrorText(err.error, t, locale === "fa") : t("Couldn't save the dish"));
      }
      toast.success(isEditing ? t("Dish saved") : t("Dish created"));
      if (isEditing) router.push("/admin/menu-items");
      else {
        // A new dish goes straight to its page, where the next step is its recipe.
        const created = await res.json().catch(() => null);
        router.push(created?.id ? `/admin/menu-items/${created.id}?added=1#recipe` : "/admin/menu-items");
      }
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const [translating, setTranslating] = React.useState(false);

  /** AI draft of the Arabic from the English; fills only the empty Arabic fields. Nothing is saved until "Save". */
  async function draftArabic() {
    if (!draft.name.trim()) return toast.error(t("Write the English name first."));
    setTranslating(true);
    try {
      const res = await fetch("/api/admin/menu-items/arabic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish: { name: draft.name, description: draft.description, ingredients: draft.ingredients, allergens: draft.allergens } }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(t(json?.error ?? "Couldn't write the Arabic. Try again."));
      setDraft((d) => ({
        ...d,
        nameAr: d.nameAr || json.nameAr || "",
        descriptionAr: d.descriptionAr || json.descriptionAr || "",
        ingredientsAr: d.ingredientsAr || json.ingredientsAr || "",
        allergensAr: d.allergensAr || json.allergensAr || "",
      }));
      toast.success(t("Arabic filled in. Check it, then save."));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranslating(false);
    }
  }

  async function handleDelete() {
    if (!isEditing) return;
    if (!confirm(t('Delete "{name}"? This can\'t be undone. To take it off the menu temporarily, switch off "Shown on menu" instead.', { name: draft.name }))) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/menu-items/${initial!.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("Couldn't delete the dish"));
      toast.success(t("Dish deleted"));
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
      <Card title={t("Dish")}>
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <ImageUploader value={draft.imageUrl} onChange={(url) => update("imageUrl", url)} folder="menu" label={t("Photo")} aspect="portrait" />
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Name")} required>
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
                  placeholder={t("e.g. Ghormeh Sabzi")}
                  dir="auto"
                  required
                />
              </Field>
              <Field label={t("Persian name")}>
                <TextInput value={draft.nameFa} onChange={(e) => update("nameFa", e.target.value)} placeholder="قورمه سبزی" lang="fa" dir="rtl" />
              </Field>
              <Field label={t("Category")} required>
                <Select value={draft.categoryId} onChange={(e) => update("categoryId", e.target.value)} required>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} dir="auto">
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("Price (AED)")} required>
                <TextInput
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min={0}
                  value={draft.price}
                  onChange={(e) => update("price", Number(e.target.value))}
                  dir="ltr"
                  required
                />
              </Field>
            </div>
            <Field label={t("Description")} hint={t("One or two sentences shown on the menu.")}>
              <TextArea value={draft.description} onChange={(e) => update("description", e.target.value)} rows={3} dir="auto" />
            </Field>
          </div>
        </div>
      </Card>

      <Card title={t("Ingredients & allergens")} description={t("Dubai food rules expect allergens to be shown before ordering.")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Ingredients")}>
            <TextArea value={draft.ingredients} onChange={(e) => update("ingredients", e.target.value)} rows={3} placeholder={t("Lamb, kidney beans, parsley, fenugreek…")} dir="auto" />
          </Field>
          <Field label={t("Allergens")}>
            <TextArea value={draft.allergens} onChange={(e) => update("allergens", e.target.value)} rows={3} placeholder={t("Contains: dairy, walnuts.")} dir="auto" />
          </Field>
        </div>
      </Card>

      <Card
        title={t("Arabic")}
        description={t("UAE law asks online menus to show ingredients in Arabic too. Shown next to the English on the website and receipts.")}
        actions={
          <button type="button" onClick={draftArabic} disabled={translating} className={chipButtonClass}>
            {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t("Fill with AI")}
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Arabic name")}>
            <TextInput value={draft.nameAr} onChange={(e) => update("nameAr", e.target.value)} lang="ar" placeholder="قورمه سبزي" dir="rtl" />
          </Field>
          <Field label={t("Arabic description")}>
            <TextArea value={draft.descriptionAr} onChange={(e) => update("descriptionAr", e.target.value)} lang="ar" rows={3} dir="rtl" />
          </Field>
          <Field label={t("Arabic ingredients")}>
            <TextArea value={draft.ingredientsAr} onChange={(e) => update("ingredientsAr", e.target.value)} lang="ar" rows={3} dir="rtl" />
          </Field>
          <Field label={t("Arabic allergens")}>
            <TextArea value={draft.allergensAr} onChange={(e) => update("allergensAr", e.target.value)} lang="ar" rows={3} dir="rtl" />
          </Field>
        </div>
      </Card>

      <Card title={t("Availability")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <SwitchRow label={t("Shown on menu")} description={t("Off hides it everywhere.")} checked={draft.isActive} onCheckedChange={(v) => update("isActive", v)} />
          <SwitchRow label={t("In stock")} description={t("Off shows it as sold out.")} checked={draft.isAvailable} onCheckedChange={(v) => update("isAvailable", v)} />
        </div>
        <details className="group mt-5 border-t border-black-iron/[0.06] pt-4">
          <summary className={cn(chipButtonClass, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
            {t("Advanced")} <span className="text-black-iron/45 group-open:hidden">· {t("web address")}</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <Field label={t("Web address")} hint={<span dir="ltr">{`shazdeh.ae/menu/${draft.slug || slugify(draft.name) || "…"}`}</span>} className="mt-3 max-w-md">
            <TextInput value={draft.slug} onChange={(e) => update("slug", slugify(e.target.value))} placeholder={slugify(draft.name)} className="font-mono text-[13px]" dir="ltr" />
          </Field>
        </details>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-black-iron/[0.07] bg-warm-white/95 px-4 py-3 pb-[max(0.75rem,var(--safe-bottom))] backdrop-blur sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
        {isEditing ? (
          <Button type="button" variant="destructive-ghost" size="sm" onClick={handleDelete} disabled={removing}>
            <Trash2 className="h-4 w-4" />
            {removing ? t("Deleting…") : t("Delete dish")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
            {t("Cancel")}
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? t("Save changes") : t("Create dish")}
          </Button>
        </div>
      </div>
    </form>
  );
}
