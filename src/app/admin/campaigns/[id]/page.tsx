import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPage } from "@/components/admin/ui";
import { CampaignEditor } from "@/components/admin/campaigns/campaign-editor";
import { CampaignSetupNotice } from "@/components/admin/campaigns/setup-notice";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { currentUser, getSessionUser } from "@/lib/auth";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { audienceCounts, campaignConfig } from "@/lib/campaigns/send";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Campaigns") };
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getAdminI18n();
  const { id } = await params;
  const [campaign, counts, user] = await Promise.all([
    prisma.campaign.findUnique({ where: { id } }),
    audienceCounts(),
    getSessionUser().then(currentUser),
  ]);
  if (!campaign) notFound();
  const { missing, from } = campaignConfig();
  return (
    <AdminPage
      title={
        <span className="flex items-center gap-2">
          <Link href="/admin/campaigns" aria-label={t("Campaigns")} className="text-dark-grey hover:text-black-iron">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {campaign.status === "DRAFT" || campaign.status === "FAILED" ? t("Edit campaign") : t("Campaign")}
        </span>
      }
    >
      {missing.length > 0 && <CampaignSetupNotice missing={missing} />}
      <CampaignEditor
        campaign={{ ...campaign, sentAt: campaign.sentAt?.toISOString() ?? null }}
        counts={counts}
        siteUrl={env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}
        from={from}
        testTo={user?.email ?? ""}
        canSend={user?.role === "ADMIN" && missing.length === 0}
      />
    </AdminPage>
  );
}
