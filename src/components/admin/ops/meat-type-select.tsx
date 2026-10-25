"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAdminI18n } from "@/components/admin/i18n";
import { messageFromUnknown } from "@/lib/error-message";

/** On an ingredient's page: whether it is raw meat, and of which kind. */
export function MeatTypeSelect({ ingredientId, value, types }: { ingredientId: string; value: string | null; types: { id: string; name: string; nameFa: string | null }[] }) {
  const { t, locale } = useAdminI18n();
  const router = useRouter();
  const [current, setCurrent] = React.useState(value ?? "");
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        aria-label={t("Kind of meat")}
        value={current}
        disabled={busy}
        onChange={async (e) => {
          const next = e.target.value;
          setBusy(true);
          try {
            const res = await fetch(`/api/admin/ops/ingredients/${ingredientId}/meat-type`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ meatTypeId: next || null }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw json;
            setCurrent(next);
            toast.success(t("Saved"));
            router.refresh();
          } catch (err) {
            toast.error(t(messageFromUnknown(err, "Could not save")));
          } finally {
            setBusy(false);
          }
        }}
        className="h-11 min-w-56 rounded-[10px] border border-black-iron/[0.12] bg-white px-3.5 text-[14px] text-black-iron"
      >
        <option value="">{t("Not raw meat")}</option>
        {types.map((m) => (
          <option key={m.id} value={m.id}>
            {locale === "fa" && m.nameFa ? m.nameFa : m.name}
          </option>
        ))}
      </select>
      {busy && <Loader2 className="h-4 w-4 animate-spin text-dark-grey" />}
    </div>
  );
}
