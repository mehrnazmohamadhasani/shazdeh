"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminI18n } from "@/components/admin/i18n";

export function NewCampaignButton() {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function create() {
    setBusy(true);
    const res = await fetch("/api/admin/campaigns", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/admin/campaigns/${json.id}`);
    else {
      toast.error(t(json.error ?? "Couldn't save"));
      setBusy(false);
    }
  }
  return (
    <Button size="sm" onClick={create} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("New campaign")}
    </Button>
  );
}
