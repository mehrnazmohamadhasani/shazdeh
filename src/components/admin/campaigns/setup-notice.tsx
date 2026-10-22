"use client";
import { Card } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";

/** Shown until the campaign settings exist on the server (Vercel → Environment Variables). */
export function CampaignSetupNotice({ missing }: { missing: string[] }) {
  const { t } = useAdminI18n();
  return (
    <Card className="border-saffron-orange/40 bg-saffron-orange/[0.06]">
      <p className="text-[14px] font-medium text-black-iron">{t("Campaigns aren't set up on this server yet")}</p>
      <p className="mt-1 text-[13px] text-dark-grey">
        {t("Add these in Vercel → Settings → Environment Variables, then redeploy:")}{" "}
        <span className="font-mono text-black-iron" dir="ltr">
          {missing.join(", ")}
        </span>
      </p>
    </Card>
  );
}
