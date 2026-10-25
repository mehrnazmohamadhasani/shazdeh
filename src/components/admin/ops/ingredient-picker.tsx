"use client";
import * as React from "react";
import { Check, ChevronDown, Plus, Search, Sparkles } from "lucide-react";
import { useAdminI18n } from "@/components/admin/i18n";
import { STRONG_MATCH, rankIngredients } from "@/lib/ops/ingredient-rank";
import type { BaseUnit } from "@/lib/ops/units";
import { cn } from "@/lib/utils";

/*
 * Choosing which stock ingredient an invoice line is. Opens on a short
 * "Best matches" list for the line as printed, filters as you type, and
 * keeps "Create a new ingredient" apart at the bottom, so a duplicate is
 * never made by accident. Keyboard: ↑ ↓ to move, Enter to choose, Esc to
 * close. An AI suggestion (from "Find matches with AI") is shown first.
 */

export type PickerIngredient = { id: string; name: string; nameFa?: string | null; unit: BaseUnit };

const UNIT_LABEL: Record<BaseUnit, string> = { g: "kg", ml: "L", pcs: "pcs" };

type Option =
  | { kind: "ingredient"; item: PickerIngredient; hint?: "ai" | "best" }
  | { kind: "create"; name: string };

export function IngredientPicker({
  id,
  value,
  onChange,
  ingredients,
  printed,
  aiSuggestion,
}: {
  id: string;
  /** The ingredient name on the line (an existing one, a new one, or empty). */
  value: string;
  onChange: (name: string) => void;
  ingredients: PickerIngredient[];
  /** The line as printed on the invoice: what "Best matches" ranks against. */
  printed: string;
  aiSuggestion?: PickerIngredient | null;
}) {
  const { t } = useAdminI18n();
  const [open, setOpen] = React.useState(false);
  // What is typed while the list is open; null = not typing (show best matches).
  const [query, setQuery] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = `${id}-list`;

  const selected = ingredients.find((i) => i.name.trim().toLowerCase() === value.trim().toLowerCase()) ?? null;
  const typing = query != null && query.trim() !== "";

  const options = React.useMemo<Option[]>(() => {
    const out: Option[] = [];
    const seen = new Set<string>();
    const push = (item: PickerIngredient, hint?: "ai" | "best") => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      out.push({ kind: "ingredient", item, hint });
    };
    if (typing) {
      const q = query!.trim().toLowerCase();
      // Starts-with and contains first (what people expect when typing), then near spellings.
      const direct = ingredients.filter((i) => i.name.toLowerCase().includes(q) || i.nameFa?.includes(query!.trim()));
      direct.sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name));
      direct.forEach((i) => push(i));
      rankIngredients(query!, ingredients).forEach((r) => push(r.item));
      const exact = ingredients.some((i) => i.name.trim().toLowerCase() === q);
      if (!exact) out.push({ kind: "create", name: query!.trim() });
    } else {
      if (aiSuggestion) push(aiSuggestion, "ai");
      rankIngredients(printed, ingredients)
        .slice(0, 4)
        .forEach((r) => push(r.item, "best"));
      [...ingredients].sort((a, b) => a.name.localeCompare(b.name)).forEach((i) => push(i));
    }
    return out;
  }, [typing, query, ingredients, printed, aiSuggestion]);

  // Bring the whole list into view (it can open near the bottom, under the save bar).
  React.useEffect(() => {
    if (open) listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  // Keep the highlighted option visible while moving with the arrow keys.
  React.useEffect(() => {
    if (open) document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  // Close on a tap outside.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function openList() {
    setOpen(true);
    setQuery(null);
    const at = selected ? options.findIndex((o) => o.kind === "ingredient" && o.item.id === selected.id) : 0;
    setActive(Math.max(0, at));
  }
  function close() {
    setOpen(false);
    setQuery(null);
  }
  function choose(o: Option) {
    onChange(o.kind === "ingredient" ? o.item.name : o.name);
    close();
  }

  const bestCount = options.filter((o) => o.kind === "ingredient" && o.hint).length;

  return (
    <div ref={wrapRef} className="relative">
      {/* Icons sit beside the text, not over it: an English name in the Persian panel runs
          left to right, so icons laid over the box would cover its first letters. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex h-11 w-full cursor-text items-center gap-2.5 rounded-[10px] border border-black-iron/[0.12] bg-white px-3.5 transition-colors focus-within:border-terracotta/60 focus-within:ring-2 focus-within:ring-terracotta/15"
      >
        <Search className="h-4 w-4 shrink-0 text-dark-grey" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          dir="auto"
          value={query ?? value}
          placeholder={t("Find an ingredient")}
          onFocus={(e) => {
            // Typing replaces the chosen name (a new search), instead of adding to it.
            e.target.select();
            openList();
          }}
          onClick={() => !open && openList()}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
            setActive(0);
            // Typing is also choosing: a name that isn't in stock becomes a new ingredient.
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) return openList();
              setActive((a) => (options.length ? (a + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length : 0));
            } else if (e.key === "Enter" && open && options[active]) {
              e.preventDefault();
              choose(options[active]);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              close();
            } else if (e.key === "Tab") {
              close();
            }
          }}
          className={cn("h-full min-w-0 flex-1 truncate bg-transparent text-[14px] text-black-iron placeholder:text-black-iron/35 focus:outline-none", selected && "font-medium")}
        />
        <span className="pointer-events-none flex shrink-0 items-center gap-2">
          {selected && <span className="rounded-full bg-black-iron/[0.06] px-2 py-0.5 text-[11.5px] font-medium text-dark-grey">{t(UNIT_LABEL[selected.unit])}</span>}
          <ChevronDown className={cn("h-4 w-4 text-dark-grey transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </div>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={t("Ingredients in stock")}
          className="absolute inset-x-0 top-full z-30 mt-1.5 mb-24 max-h-80 scroll-mb-24 overflow-y-auto overscroll-contain rounded-[14px] border border-black-iron/[0.08] bg-white p-1.5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.25)]"
        >
          {!typing && bestCount > 0 && <GroupLabel>{t("Best matches for “{name}”", { name: printed.trim() || "…" })}</GroupLabel>}
          {options.map((o, i) => {
            const firstOfRest = !typing && bestCount > 0 && i === bestCount;
            return (
              <React.Fragment key={o.kind === "ingredient" ? o.item.id : "create"}>
                {firstOfRest && <GroupLabel className="mt-1 border-t border-black-iron/[0.06] pt-2.5">{t("All ingredients")}</GroupLabel>}
                {o.kind === "create" && options.length > 1 && <div className="my-1 border-t border-black-iron/[0.06]" />}
                <div
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={o.kind === "ingredient" && selected?.id === o.item.id}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                  onPointerMove={() => setActive(i)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 text-[14px]",
                    i === active ? "bg-terracotta/[0.07]" : "",
                  )}
                >
                  {o.kind === "ingredient" ? (
                    <>
                      <span className="min-w-0 flex-1">
                        <span dir="auto" className="block truncate font-medium text-black-iron">{o.item.name}</span>
                        {o.item.nameFa && (
                          <span lang="fa" dir="rtl" className="block truncate text-[12.5px] text-dark-grey">{o.item.nameFa}</span>
                        )}
                      </span>
                      {o.hint === "ai" && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-terracotta/[0.1] px-2 py-0.5 text-[11.5px] font-medium text-terracotta-ink">
                          <Sparkles className="h-3 w-3" /> {t("AI suggests")}
                        </span>
                      )}
                      <span className="shrink-0 rounded-full bg-black-iron/[0.05] px-2 py-0.5 text-[11.5px] text-dark-grey">{t(UNIT_LABEL[o.item.unit])}</span>
                      <Check className={cn("h-4 w-4 shrink-0 text-terracotta-ink", selected?.id === o.item.id ? "opacity-100" : "opacity-0")} aria-hidden />
                    </>
                  ) : (
                    <>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-saffron-orange/[0.18] text-cinnamon-bark">
                        <Plus className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-black-iron">
                          {t("Create a new ingredient")} <span dir="auto">“{o.name}”</span>
                        </span>
                        <span className="block text-[12.5px] text-dark-grey">{t("Only if it isn't in stock yet")}</span>
                      </span>
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          {options.length === 0 && <p className="px-3 py-3 text-[13px] text-dark-grey">{t("No ingredients yet.")}</p>}
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-black-iron/45", className)}>{children}</p>;
}

/** Under the picker: is this line an existing ingredient, a new one, or is there a likely match to use? */
export function IngredientStatus({
  value,
  ingredients,
  printed,
  aiSuggestion,
  onUse,
}: {
  value: string;
  ingredients: PickerIngredient[];
  printed: string;
  aiSuggestion?: PickerIngredient | null;
  onUse: (name: string) => void;
}) {
  const { t } = useAdminI18n();
  const selected = ingredients.find((i) => i.name.trim().toLowerCase() === value.trim().toLowerCase()) ?? null;
  if (selected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-olive-leaf">
        <Check className="h-3.5 w-3.5" /> {t("In stock — the price will update")}
      </span>
    );
  }
  if (!value.trim()) return <>{t("Leave empty to keep it out of stock")}</>;
  // Not in stock: offer the likely one before a duplicate is created.
  const best = aiSuggestion ?? rankIngredients(value, ingredients)[0]?.item ?? rankIngredients(printed, ingredients)[0]?.item;
  const strong = aiSuggestion || (best && Math.max(...[value, printed].map((p) => rankIngredients(p, [best])[0]?.score ?? 0)) >= STRONG_MATCH);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-center gap-1.5 text-cinnamon-bark">
        <Plus className="h-3.5 w-3.5" /> {t("New ingredient — will be added to stock")}
      </span>
      {best && strong && (
        <button
          type="button"
          onClick={() => onUse(best.name)}
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-terracotta/[0.09] px-2.5 text-[12.5px] font-medium text-terracotta-ink transition-colors hover:bg-terracotta/[0.16]"
        >
          {aiSuggestion && <Sparkles className="h-3 w-3" />}
          {t("Use “{name}”", { name: best.name })}
        </button>
      )}
    </span>
  );
}
