"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ChefHat, Keyboard, Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { useDocumentUpload } from "@/components/admin/ops/upload-button";
import { messageFromUnknown } from "@/lib/error-message";
import { cn } from "@/lib/utils";

/*
 * The recipe step on a dish's page. A dish without a recipe offers three
 * ways to write one — type it, a photo or PDF of the recipe sheet, or say
 * it to the assistant — each ending as a draft that the owner approves.
 * A dish with a recipe shows where it stands (approved or waiting) and
 * its cost, with a way into the recipe.
 */

export type DishRecipeSummary = {
  id: string;
  hasApproved: boolean;
  hasDraft: boolean;
  perUnitFils: number | null;
  verified: boolean;
  foodCostPct: number | null;
} | null;

export function DishRecipeStep({
  menuItemId,
  dishName,
  recipe,
  justAdded,
}: {
  menuItemId: string;
  dishName: string;
  recipe: DishRecipeSummary;
  justAdded: boolean;
}) {
  const { t, money, number } = useAdminI18n();
  const router = useRouter();
  const [typing, setTyping] = React.useState(false);
  const file = React.useRef<HTMLInputElement>(null);
  const { busy: reading, progressLabel, send } = useDocumentUpload();

  if (recipe) {
    return (
      <section id="recipe" className="scroll-mt-6 rounded-[18px] border border-black-iron/[0.08] bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <ChefHat className="h-5 w-5 text-terracotta-ink" />
          <h2 className="text-[17px] font-semibold text-black-iron">{t("Recipe & food cost")}</h2>
          {recipe.hasApproved ? (
            <StatusPill tone="good">{t("Approved")}</StatusPill>
          ) : (
            <StatusPill tone="warn">{t("Draft — waiting for approval")}</StatusPill>
          )}
          {recipe.hasApproved && recipe.hasDraft && <StatusPill tone="accent">{t("Changes waiting for approval")}</StatusPill>}
          <Button asChild size="md" variant="outline" className="ms-auto">
            <Link href={`/admin/ops/recipes/${recipe.id}`}>{t("Open recipe")}</Link>
          </Button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-[12px] bg-black-iron/[0.03] px-3 py-2.5">
            <dt className="text-[12.5px] text-dark-grey">{t("Cost per portion")}</dt>
            <dd className="text-[17px] font-semibold tabular-nums">{recipe.perUnitFils == null ? t("Unknown") : money(Math.round(recipe.perUnitFils))}</dd>
            {recipe.perUnitFils != null && <dd className="text-[12px] text-dark-grey">{recipe.verified ? t("verified prices") : t("estimated")}</dd>}
          </div>
          <div className="rounded-[12px] bg-black-iron/[0.03] px-3 py-2.5">
            <dt className="text-[12.5px] text-dark-grey">{t("Food cost %")}</dt>
            <dd className="text-[17px] font-semibold tabular-nums">{recipe.foodCostPct == null ? t("Unknown") : `${number(recipe.foodCostPct, { max: 1 })}%`}</dd>
          </div>
        </dl>
      </section>
    );
  }

  async function typeIt() {
    setTyping(true);
    try {
      const res = await fetch("/api/admin/ops/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "DISH", menuItemId, name: null, nameFa: null, yieldUnit: "PCS" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw json;
      router.push(`/admin/ops/recipes/${json.id}?edit=1#edit`);
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Could not save")));
      setTyping(false);
    }
  }

  const tile =
    "flex min-h-[124px] flex-col items-start gap-1.5 rounded-[14px] border border-black-iron/[0.1] bg-white p-4 text-start transition-colors hover:border-terracotta/50 hover:bg-terracotta/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 disabled:opacity-60";
  // The person goes on with the amounts, for one portion or "for 10 portions: …".
  const say = `${t("Recipe for {dish}:", { dish: dishName })} `;

  return (
    <section
      id="recipe"
      className={cn(
        "scroll-mt-6 rounded-[18px] border bg-white p-5 md:p-6",
        justAdded ? "border-terracotta/50 shadow-[0_0_0_4px_rgba(206,73,39,0.08)]" : "border-black-iron/[0.08]",
      )}
    >
      {justAdded && <p className="mb-1 text-[13px] font-medium text-olive-leaf">{t("Dish saved.")}</p>}
      <h2 className="text-[19px] font-bold text-black-iron">{justAdded ? t("Next: add its recipe") : t("This dish has no recipe yet")}</h2>
      <p className="mt-1 max-w-2xl text-[14px] text-dark-grey">
        {t("The recipe sets the food cost, takes the ingredients out of stock with every sale, and shows the profit. Choose how to add it:")}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={typeIt} disabled={typing || reading} className={tile}>
          {typing ? <Loader2 className="h-5 w-5 animate-spin text-terracotta-ink" /> : <Keyboard className="h-5 w-5 text-terracotta-ink" />}
          <span className="text-[15px] font-semibold text-black-iron">{t("Type it")}</span>
          <span className="text-[13px] text-dark-grey">{t("Pick each ingredient and its amount per portion.")}</span>
        </button>
        <button type="button" onClick={() => file.current?.click()} disabled={typing || reading} className={tile}>
          {reading ? <Loader2 className="h-5 w-5 animate-spin text-terracotta-ink" /> : <Camera className="h-5 w-5 text-terracotta-ink" />}
          <span className="text-[15px] font-semibold text-black-iron">{progressLabel ?? t("Photo or PDF")}</span>
          <span className="text-[13px] text-dark-grey">{t("AI reads the recipe sheet; you check each line before it is saved.")}</span>
        </button>
        <Link href={`/admin/ops/assistant?say=${encodeURIComponent(say)}`} className={tile}>
          <Mic className="h-5 w-5 text-terracotta-ink" />
          <span className="text-[15px] font-semibold text-black-iron">{t("Say it")}</span>
          <span className="text-[13px] text-dark-grey">{t("Tell the assistant, e.g. “120 g lamb, 80 g herbs, 150 g rice”.")}</span>
        </Link>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, 1);
          e.target.value = "";
          if (files.length) void send("recipe", files, `?dish=${menuItemId}`);
        }}
      />
      <p className="mt-3 text-[12.5px] text-dark-grey">{t("Every way saves a draft. The owner approves it as the kitchen standard.")}</p>
    </section>
  );
}
