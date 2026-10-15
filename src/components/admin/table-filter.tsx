"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { useAdminI18n } from "@/components/admin/i18n";
import { cn } from "@/lib/utils";

/*
 * A search box for a server-rendered list: hides the rows inside the
 * element with id `target` whose `data-search` text doesn't contain what
 * was typed. Matching ignores case and works for English and Persian.
 */
export function TableFilter({ target, placeholder, className }: { target: string; placeholder?: string; className?: string }) {
  const { t } = useAdminI18n();
  const [q, setQ] = React.useState("");
  React.useEffect(() => {
    const needle = q.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>(`#${target} [data-search]`).forEach((row) => {
      row.hidden = !!needle && !(row.dataset.search ?? "").toLowerCase().includes(needle);
    });
  }, [q, target]);
  return (
    <label className={cn("relative block", className)}>
      <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-grey" />
      <span className="sr-only">{t("Search")}</span>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? t("Search…")}
        className="h-11 w-full rounded-full border border-black-iron/[0.12] bg-white pe-4 ps-10 text-[14px] placeholder:text-black-iron/40 focus:border-terracotta/60 focus:outline-none focus:ring-2 focus:ring-terracotta/15"
      />
    </label>
  );
}
