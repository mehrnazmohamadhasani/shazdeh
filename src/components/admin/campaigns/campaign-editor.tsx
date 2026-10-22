"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Loader2, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Field, Select, StatusPill, TextArea, TextInput } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { campaignHtml, type CampaignContent } from "@/lib/campaigns/email";
import { AUDIENCE_LABEL, STATUS_TONE } from "@/components/admin/campaigns/labels";

type Audience = "marketing" | "lapsed" | "gift_no_order";

export type CampaignRow = CampaignContent & {
  id: string;
  audience: string;
  status: string;
  recipientCount: number | null;
  broadcastId: string | null;
  error: string | null;
  sentAt: string | null;
};

/*
 * Write → preview → send yourself a test → send. A sent campaign is shown
 * read-only, with a link to its numbers in Resend.
 */
export function CampaignEditor({
  campaign,
  counts,
  siteUrl,
  from,
  testTo,
  canSend,
}: {
  campaign: CampaignRow;
  counts: Record<Audience, number>;
  siteUrl: string;
  from: string | null;
  testTo: string;
  canSend: boolean;
}) {
  const { t, date } = useAdminI18n();
  const router = useRouter();
  const editable = campaign.status === "DRAFT" || campaign.status === "FAILED";
  const [d, setD] = React.useState(campaign);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "save" | "test" | "send" | "delete">(null);
  const [to, setTo] = React.useState(testTo);
  const set = <K extends keyof CampaignRow>(k: K, v: CampaignRow[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  const audience = (d.audience in counts ? d.audience : "marketing") as Audience;
  const recipients = counts[audience];

  const html = React.useMemo(
    () => campaignHtml(d, { siteUrl, firstName: "there", unsubscribeUrl: "#" }),
    [d, siteUrl],
  );

  async function save(quiet = false) {
    setBusy("save");
    try {
      const body = {
        subject: d.subject,
        previewText: d.previewText,
        heading: d.heading,
        body: d.body,
        imageUrl: d.imageUrl,
        buttonLabel: d.buttonLabel,
        buttonUrl: d.buttonUrl,
        promoCode: d.promoCode,
        audience,
      };
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't save");
      setDirty(false);
      if (!quiet) toast.success(t("Saved"));
      return true;
    } catch (e) {
      toast.error(t((e as Error).message));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (dirty && !(await save(true))) return;
    setBusy("test");
    const res = await fetch(`/api/admin/campaigns/${campaign.id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: to.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) toast.success(t("Test sent to {to}", { to: to.trim() }));
    else toast.error(t(json.error ?? "Couldn't send"));
  }

  async function send() {
    if (dirty && !(await save(true))) return;
    if (!confirm(t("Send “{subject}” to {n} people now? This can't be undone.", { subject: d.subject, n: recipients }))) return;
    setBusy("send");
    const res = await fetch(`/api/admin/campaigns/${campaign.id}/send`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) toast.success(t("Sent to {n} people", { n: json.recipients }));
    else toast.error(t(json.error ?? "Couldn't send"));
    router.refresh();
  }

  async function remove() {
    if (!confirm(t("Delete this draft?"))) return;
    setBusy("delete");
    const res = await fetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/campaigns");
    else {
      toast.error(t("Couldn't delete"));
      setBusy(null);
    }
  }

  const statusLabel = { DRAFT: "Draft", SENDING: "Sending", SENT: "Sent", FAILED: "Failed" }[campaign.status] ?? campaign.status;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        {!editable && (
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={STATUS_TONE[campaign.status] ?? "neutral"}>{t(statusLabel)}</StatusPill>
              <span className="text-[13px] text-dark-grey">
                {campaign.sentAt && date(campaign.sentAt, { dateStyle: "medium", timeStyle: "short" })}
                {campaign.recipientCount !== null && ` · ${t("{n} recipients", { n: campaign.recipientCount })}`}
              </span>
              {campaign.broadcastId && (
                <a
                  href={`https://resend.com/broadcasts/${campaign.broadcastId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-link inline-flex items-center gap-1 text-[13px] text-black-iron hover:text-terracotta-ink"
                >
                  {t("Open in Resend (opens, clicks, unsubscribes)")} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </Card>
        )}
        {campaign.status === "FAILED" && campaign.error && (
          <Card className="border-pomegranate-red/30">
            <p className="text-[13px] font-medium text-pomegranate-red">{t("The last send didn't go through")}</p>
            <p className="mt-1 break-words font-mono text-[12px] text-dark-grey" dir="ltr">
              {campaign.error}
            </p>
            <p className="mt-2 text-[12.5px] text-dark-grey">{t("Check Broadcasts in Resend before trying again, so nobody gets it twice.")}</p>
          </Card>
        )}

        <Card title={t("Email")}>
          <fieldset disabled={!editable} className="space-y-4">
            <Field label={t("Subject")} hint={t("What people see in their inbox.")}>
              <TextInput dir="auto" value={d.subject} onChange={(e) => set("subject", e.target.value)} />
            </Field>
            <Field label={t("Preview line")} hint={t("Optional. The grey line next to the subject in most inboxes.")}>
              <TextInput dir="auto" value={d.previewText ?? ""} onChange={(e) => set("previewText", e.target.value || null)} />
            </Field>
            <Field label={t("Headline")}>
              <TextInput dir="auto" value={d.heading} onChange={(e) => set("heading", e.target.value)} />
            </Field>
            <Field label={t("Message")} hint={t("Leave an empty line between paragraphs. It starts with “Hi <first name>,”.")}>
              <TextArea dir="auto" rows={8} value={d.body} onChange={(e) => set("body", e.target.value)} />
            </Field>
            <Field label={t("Image link")} hint={t("Optional. A photo link starting with https://, e.g. from the Gallery.")}>
              <TextInput dir="ltr" value={d.imageUrl ?? ""} onChange={(e) => set("imageUrl", e.target.value || null)} placeholder="https://…" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Button text")}>
                <TextInput dir="auto" value={d.buttonLabel ?? ""} onChange={(e) => set("buttonLabel", e.target.value || null)} placeholder="Order now" />
              </Field>
              <Field label={t("Button link")} hint={t("A page on the site like /order, or a full https:// link.")}>
                <TextInput dir="ltr" value={d.buttonUrl ?? ""} onChange={(e) => set("buttonUrl", e.target.value || null)} placeholder="/order" />
              </Field>
            </div>
            <Field label={t("Promo code")} hint={t("Optional. Shown in a box in the email — create it first in Promo codes.")}>
              <TextInput dir="ltr" className="font-mono uppercase" value={d.promoCode ?? ""} onChange={(e) => set("promoCode", e.target.value.toUpperCase() || null)} />
            </Field>
          </fieldset>
        </Card>

        <Card title={t("Who gets it")}>
          <fieldset disabled={!editable} className="space-y-2">
            <Select value={audience} onChange={(e) => set("audience", e.target.value)}>
              {(Object.keys(counts) as Audience[]).map((a) => (
                <option key={a} value={a}>
                  {t(AUDIENCE_LABEL[a])} · {counts[a]}
                </option>
              ))}
            </Select>
            <p className="text-[12.5px] text-dark-grey">
              {t("Only customers who agreed to news and offers, have an email, and haven't unsubscribed.")}
            </p>
          </fieldset>
        </Card>

        {editable && (
          <Card title={t("Send")}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t("Send a test to")} className="min-w-[14rem] flex-1">
                  <TextInput dir="ltr" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
                <Button variant="outline" size="sm" onClick={sendTest} disabled={busy !== null || !to.trim()}>
                  {busy === "test" && <Loader2 className="h-4 w-4 animate-spin" />} {t("Send test")}
                </Button>
              </div>
              {from && (
                <p className="text-[12.5px] text-dark-grey">
                  {t("From")}: <span dir="ltr">{from}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black-iron/[0.08] pt-4">
                <Button variant="destructive-ghost" size="sm" onClick={remove} disabled={busy !== null}>
                  <Trash2 className="h-4 w-4" /> {t("Delete")}
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => save()} disabled={busy !== null || !dirty}>
                    {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("Save draft")}
                  </Button>
                  <Button size="sm" onClick={send} disabled={busy !== null || !canSend || recipients === 0}>
                    {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{" "}
                    {t("Send to {n} people", { n: recipients })}
                  </Button>
                </div>
              </div>
              {!canSend && <p className="text-[12.5px] text-dark-grey">{t("Only an admin can send, once campaigns are set up on the server.")}</p>}
            </div>
          </Card>
        )}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card title={t("Preview")} bodyClassName="p-0">
          <iframe title={t("Preview")} srcDoc={html} sandbox="" className="h-[720px] w-full rounded-b-[16px] border-0 bg-warm-white" />
        </Card>
      </div>
    </div>
  );
}
