import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { loadCustomerRows } from "@/lib/ordering/customers";
import { campaignRecipients, type CampaignAudience } from "@/lib/ordering/customer-list";
import { BROADCAST_FIRST_NAME, BROADCAST_UNSUBSCRIBE_URL, campaignHtml, campaignText } from "@/lib/campaigns/email";
import { ResendError, resend, type ResendContact } from "@/lib/campaigns/resend";

/*
 * Sending a campaign:
 *  1. copy unsubscribes from Resend into MarketingUnsubscribe;
 *  2. work out the recipients (opted in, not unsubscribed, the filter);
 *  3. make one Resend segment hold exactly those contacts;
 *  4. create the Broadcast with send: true.
 * Resend sends it from its marketing quota and adds the unsubscribe link.
 */

/** The segment this panel manages. Don't edit it in Resend. */
const SEGMENT = "SHĀZDEH campaigns (managed by the admin panel)";
/** The segment is reused, so give Resend time to pick up one campaign's list before changing it for the next. */
const MIN_GAP_MS = 15 * 60_000;

export function campaignConfig() {
  const from = process.env.CAMPAIGN_FROM?.trim() || null;
  const replyTo = process.env.CAMPAIGN_REPLY_TO?.trim() || null;
  const missing = [!process.env.RESEND_CAMPAIGN_API_KEY?.trim() && "RESEND_CAMPAIGN_API_KEY", !from && "CAMPAIGN_FROM"].filter(Boolean) as string[];
  return { from, replyTo, missing };
}

const siteUrl = () => env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

/** Records Resend's unsubscribed contacts here, so they leave every audience. */
async function pullUnsubscribes(contacts: ResendContact[]) {
  const emails = contacts.filter((c) => c.unsubscribed).map((c) => c.email.trim().toLowerCase());
  if (emails.length) {
    await prisma.marketingUnsubscribe.createMany({ data: emails.map((email) => ({ email })), skipDuplicates: true });
  }
  return new Set(emails);
}

/** Recipient count per audience, for the editor. */
export async function audienceCounts(now = new Date()): Promise<Record<CampaignAudience, number>> {
  const rows = await loadCustomerRows();
  return {
    marketing: campaignRecipients(rows, "marketing", now).length,
    lapsed: campaignRecipients(rows, "lapsed", now).length,
    gift_no_order: campaignRecipients(rows, "gift_no_order", now).length,
  };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof prisma.campaign.findUnique>>>;

export async function sendTestEmail(campaign: Loaded, to: string) {
  const { from, replyTo, missing } = campaignConfig();
  if (missing.length) throw new Error(`Missing settings on the server: ${missing.join(", ")}`);
  const opts = { siteUrl: siteUrl(), firstName: "there", unsubscribeUrl: `${siteUrl()}/` };
  await resend.sendEmail({
    from: from!,
    to,
    replyTo,
    subject: `[TEST] ${campaign.subject}`,
    html: campaignHtml(campaign, opts),
    text: campaignText(campaign, opts),
  });
}

export type SendResult = { ok: true; recipients: number } | { ok: false; error: string };

export async function sendCampaign(id: string): Promise<SendResult> {
  const { from, replyTo, missing } = campaignConfig();
  if (missing.length) return { ok: false, error: `Missing settings on the server: ${missing.join(", ")}` };

  const recent = await prisma.campaign.findFirst({
    where: { id: { not: id }, OR: [{ status: "SENDING" }, { sentAt: { gt: new Date(Date.now() - MIN_GAP_MS) } }] },
    select: { id: true },
  });
  if (recent) return { ok: false, error: "Another campaign was sent in the last 15 minutes. Please wait a little before sending the next one." };

  // Claim it: only one send per campaign, even with a double click.
  const claimed = await prisma.campaign.updateMany({ where: { id, status: { in: ["DRAFT", "FAILED"] } }, data: { status: "SENDING", error: null } });
  if (claimed.count === 0) return { ok: false, error: "This campaign has already been sent." };
  const campaign = (await prisma.campaign.findUnique({ where: { id } }))!;

  try {
    const contacts = await resend.contacts();
    const unsubscribed = await pullUnsubscribes(contacts);
    const recipients = campaignRecipients(await loadCustomerRows(), campaign.audience as CampaignAudience).filter(
      (r) => !unsubscribed.has(r.email),
    );
    if (recipients.length === 0) throw new Error("Nobody in this audience has agreed to receive offers yet.");

    const segmentId = await resend.ensureSegment(SEGMENT);
    const existing = new Map(contacts.map((c) => [c.email.trim().toLowerCase(), c]));
    const members = new Map((await resend.segmentContacts(segmentId)).map((c) => [c.email.trim().toLowerCase(), c]));
    const wanted = new Set(recipients.map((r) => r.email));
    for (const r of recipients) {
      if (members.has(r.email)) continue;
      const contact = existing.get(r.email);
      if (contact) await resend.addToSegment(contact.id, segmentId);
      else
        await resend.createContact(r.email, r.firstName, segmentId).catch(async (e) => {
          // Created since we listed (or casing differs): add the existing contact by email.
          if (e instanceof ResendError && e.status >= 400 && e.status < 500) await resend.addToSegment(r.email, segmentId);
          else throw e;
        });
    }
    for (const [email, c] of members) if (!wanted.has(email)) await resend.removeFromSegment(c.id, segmentId);

    const opts = { siteUrl: siteUrl(), firstName: BROADCAST_FIRST_NAME, unsubscribeUrl: BROADCAST_UNSUBSCRIBE_URL };
    const broadcast = await resend.sendBroadcast({
      segmentId,
      from: from!,
      replyTo,
      subject: campaign.subject,
      html: campaignHtml(campaign, opts),
      text: campaignText(campaign, opts),
      name: `${campaign.subject} (${new Date().toISOString().slice(0, 10)})`,
    });
    await prisma.campaign.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), recipientCount: recipients.length, broadcastId: broadcast.id },
    });
    return { ok: true, recipients: recipients.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.campaign.update({ where: { id }, data: { status: "FAILED", error: error.slice(0, 500) } });
    return { ok: false, error };
  }
}
