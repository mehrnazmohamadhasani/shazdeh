import { test } from "node:test";
import assert from "node:assert/strict";
import { BROADCAST_FIRST_NAME, BROADCAST_UNSUBSCRIBE_URL, absoluteLink, campaignHtml, campaignText, paragraphs } from "../../campaigns/email";
import { campaignRecipients, mergeCustomers } from "../customer-list";

const content = {
  subject: "Yalda night <3",
  previewText: "Pomegranates are back",
  heading: "Yalda at SHĀZDEH",
  body: "Line one\nline two\n\n\nSecond paragraph <b>not bold</b>",
  imageUrl: null,
  buttonLabel: "Order now",
  buttonUrl: "/order",
  promoCode: "YALDA15",
};

test("campaign email: paragraphs, escaping, links and Resend placeholders", () => {
  assert.deepEqual(paragraphs("a\nb\n\n\n c "), [["a", "b"], ["c"]]);
  assert.equal(absoluteLink("/order", "https://shazdeh.ae/"), "https://shazdeh.ae/order");
  assert.equal(absoluteLink("https://x.ae/a", "https://shazdeh.ae"), "https://x.ae/a");
  const html = campaignHtml(content, { siteUrl: "https://shazdeh.ae", firstName: BROADCAST_FIRST_NAME, unsubscribeUrl: BROADCAST_UNSUBSCRIBE_URL });
  assert.match(html, /Line one<br>line two/);
  assert.match(html, /&lt;b&gt;not bold&lt;\/b&gt;/);
  assert.match(html, /href="https:\/\/shazdeh\.ae\/order"/);
  assert.match(html, /YALDA15/);
  assert.ok(html.includes("Hi {{{contact.first_name|there}}},"));
  assert.ok(html.includes('href="{{{RESEND_UNSUBSCRIBE_URL}}}"'));
  const text = campaignText(content, { siteUrl: "https://shazdeh.ae", firstName: "Sara", unsubscribeUrl: "#" });
  assert.match(text, /Hi Sara,/);
  assert.match(text, /Order now: https:\/\/shazdeh\.ae\/order/);
});

test("campaign recipients: only opted in, with an email, one per email", () => {
  const d = new Date("2026-10-01T00:00:00Z");
  const rows = mergeCustomers(
    [
      { phone: "+1", name: "Sara Karimi", email: "Sara@x.com", marketingOptIn: true, createdAt: d },
      { phone: "+2", name: "Ali", email: "sara@x.com", marketingOptIn: true, createdAt: d },
      { phone: "+3", name: "Reza", email: null, marketingOptIn: true, createdAt: d },
      { phone: "+4", name: "Mina", email: "mina@x.com", marketingOptIn: false, createdAt: d },
      { phone: "+5", name: "Nima", email: "nima@x.com", marketingOptIn: true, createdAt: d },
    ],
    [],
    [],
    new Set(["nima@x.com"]),
  );
  const list = campaignRecipients(rows, "marketing");
  assert.deepEqual(list, [{ email: "sara@x.com", firstName: "Sara" }]);
});
