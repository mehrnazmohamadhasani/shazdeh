import Link from "next/link";
import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { NewCampaignButton } from "@/components/admin/campaigns/new-campaign-button";
import { CampaignSetupNotice } from "@/components/admin/campaigns/setup-notice";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { campaignConfig } from "@/lib/campaigns/send";
import { AUDIENCE_LABEL, STATUS_TONE } from "@/components/admin/campaigns/labels";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Campaigns") };
}

export default async function CampaignsPage() {
  const { t, date } = await getAdminI18n();
  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const { missing } = campaignConfig();
  return (
    <AdminPage
      title={t("Campaigns")}
      description={t("Emails with news and offers, sent only to customers who agreed to receive them.")}
      actions={<NewCampaignButton />}
    >
      {missing.length > 0 && <CampaignSetupNotice missing={missing} />}
      {campaigns.length === 0 ? (
        <Card>
          <EmptyState title={t("No campaigns yet")} description={t("Write your first email — you can send yourself a test before anyone else gets it.")} />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[16px] border border-black-iron/[0.07] bg-white">
          <table className="w-full text-start text-[13px]">
            <thead className="border-b border-black-iron/[0.08] text-[10px] uppercase tracking-[0.2em] text-dark-grey">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("Subject")}</th>
                <th className="px-4 py-3 text-start font-medium max-md:hidden">{t("Audience")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("Status")}</th>
                <th className="px-4 py-3 text-end font-medium max-sm:hidden">{t("Recipients")}</th>
                <th className="px-4 py-3 text-start font-medium max-md:hidden">{t("Date")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black-iron/[0.06]">
              {campaigns.map((c) => (
                <tr key={c.id} className="relative hover:bg-black-iron/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/campaigns/${c.id}`} dir="auto" className="row-link admin-link font-semibold text-black-iron hover:text-terracotta-ink">
                      {c.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-dark-grey max-md:hidden">{t(AUDIENCE_LABEL[c.audience] ?? c.audience)}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={STATUS_TONE[c.status] ?? "neutral"}>{t(c.status === "DRAFT" ? "Draft" : c.status === "SENDING" ? "Sending" : c.status === "SENT" ? "Sent" : "Failed")}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums max-sm:hidden">{c.recipientCount ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-dark-grey max-md:hidden">
                    {date(c.sentAt ?? c.createdAt, { dateStyle: "medium" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
