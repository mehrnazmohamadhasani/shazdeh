import { cn } from "@/lib/utils";
import type { DishArabicView } from "@/lib/dish";

/**
 * The dish in Arabic, under the English: name, description, ingredients
 * and allergens (UAE Cabinet Resolution 66/2023, Art. 40 — ingredients
 * in Arabic too). Renders nothing until the dish has Arabic.
 */
export function ArabicDetails({ arabic, className }: { arabic: DishArabicView | null | undefined; className?: string }) {
  if (!arabic) return null;
  return (
    <div lang="ar" dir="rtl" className={cn("space-y-2 border-t border-black-iron/10 pt-5 text-right text-[14px] leading-[1.7] text-black-iron/85", className)}>
      {arabic.name && <p className="text-[15px] font-semibold text-black-iron">{arabic.name}</p>}
      {arabic.description && <p>{arabic.description}</p>}
      {arabic.ingredients && (
        <p>
          <span className="font-semibold">المكونات: </span>
          {arabic.ingredients}
        </p>
      )}
      {arabic.allergens && (
        <p>
          <span className="font-semibold">مسببات الحساسية: </span>
          {arabic.allergens}
        </p>
      )}
    </div>
  );
}
