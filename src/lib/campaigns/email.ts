/*
 * The campaign email, in the same SHĀZDEH style as order emails. Pure, so
 * the admin preview, the test send and the Resend Broadcast all use one
 * template. Resend fills {{{contact.first_name|there}}} and
 * {{{RESEND_UNSUBSCRIBE_URL}}} per recipient.
 */

export type CampaignContent = {
  subject: string;
  previewText: string | null;
  heading: string;
  body: string;
  imageUrl: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  promoCode: string | null;
};

export type RenderOptions = {
  siteUrl: string;
  /** "{{{contact.first_name|there}}}" for a Broadcast, a real name (or "there") for a test. */
  firstName: string;
  /** "{{{RESEND_UNSUBSCRIBE_URL}}}" for a Broadcast. */
  unsubscribeUrl: string;
};

export const BROADCAST_FIRST_NAME = "{{{contact.first_name|there}}}";
export const BROADCAST_UNSUBSCRIBE_URL = "{{{RESEND_UNSUBSCRIBE_URL}}}";

const esc = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Paragraphs split on blank lines; single line breaks are kept. */
export function paragraphs(body: string): string[][] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((p) => p.length > 0);
}

/** "/order" → "https://shazdeh.ae/order"; absolute https links are kept. */
export function absoluteLink(url: string, siteUrl: string) {
  return /^https?:\/\//i.test(url) ? url : `${siteUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

export function campaignHtml(c: CampaignContent, o: RenderOptions): string {
  const button =
    c.buttonLabel && c.buttonUrl
      ? `<p style="margin:24px 0 8px"><a href="${esc(absoluteLink(c.buttonUrl, o.siteUrl))}" style="background:#ce4927;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${esc(c.buttonLabel)}</a></p>`
      : "";
  const promo = c.promoCode
    ? `<p style="margin:20px 0;padding:14px 18px;border:1px dashed #ce4927;border-radius:12px;text-align:center;font-size:14px">Use code <strong style="font-family:ui-monospace,Menlo,monospace;font-size:18px;letter-spacing:.08em;color:#ce4927">${esc(c.promoCode)}</strong> at checkout</p>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject)}</title></head>
<body style="margin:0;background:#fdf6ec">
${c.previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.previewText)}</div>` : ""}
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:28px 20px;color:#1d1d1b;font-size:15px;line-height:1.55">
<p style="color:#ce4927;font-weight:700;letter-spacing:.12em;margin:0 0 20px">SHĀZDEH</p>
${c.imageUrl ? `<img src="${esc(absoluteLink(c.imageUrl, o.siteUrl))}" alt="" width="520" style="display:block;width:100%;height:auto;border-radius:16px;margin:0 0 20px">` : ""}
<h1 dir="auto" style="font-size:24px;line-height:1.2;margin:0 0 14px">${esc(c.heading)}</h1>
<p style="margin:0 0 12px">Hi ${o.firstName},</p>
${paragraphs(c.body)
  .map((lines) => `<p dir="auto" style="margin:0 0 12px">${lines.map(esc).join("<br>")}</p>`)
  .join("\n")}
${promo}${button}
<p style="color:#777;font-size:12px;margin-top:32px;border-top:1px solid #e8dccb;padding-top:14px">You're getting this because you said yes to SHĀZDEH news and offers. <a href="${o.unsubscribeUrl}" style="color:#777">Unsubscribe</a><br>SHĀZDEH — Persian Cuisine · <a href="${esc(o.siteUrl)}" style="color:#777">${esc(o.siteUrl.replace(/^https?:\/\//, ""))}</a></p>
</div></body></html>`;
}

export function campaignText(c: CampaignContent, o: RenderOptions): string {
  return [
    "SHĀZDEH",
    "",
    c.heading,
    "",
    `Hi ${o.firstName},`,
    "",
    ...paragraphs(c.body).map((p) => `${p.join("\n")}\n`),
    c.promoCode ? `Use code ${c.promoCode} at checkout.\n` : null,
    c.buttonLabel && c.buttonUrl ? `${c.buttonLabel}: ${absoluteLink(c.buttonUrl, o.siteUrl)}\n` : null,
    `Unsubscribe: ${o.unsubscribeUrl}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
