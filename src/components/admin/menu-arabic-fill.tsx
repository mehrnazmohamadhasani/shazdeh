"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { chipButtonClass } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";

/** One tap: AI writes the Arabic for every dish that has none yet (UAE law: ingredients in Arabic too). */
export function MenuArabicFill({ missing }: { missing: number }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  if (missing === 0) return null;

  async function fill() {
    if (!confirm(t("Write the Arabic name, description, ingredients and allergens with AI for {n} dishes? Check them afterwards on each dish.", { n: missing }))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/menu-items/arabic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missing: true }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(t(json?.error ?? "Couldn't write the Arabic. Try again."));
      toast.success(t("Arabic added to {n} dishes.", { n: json.filled }));
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={fill} disabled={busy} className={chipButtonClass}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {busy ? t("Writing Arabic…") : t("Arabic missing · {n}", { n: missing })}
    </button>
  );
}
