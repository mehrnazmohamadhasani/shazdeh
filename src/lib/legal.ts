/*
 * Customer policies for direct ordering — DRAFTS. Written against the
 * UAE consumer-protection, e-commerce and data-protection requirements
 * summarised in docs/ordering/legal-dubai.md, but they must be reviewed
 * by a UAE lawyer (and published in Arabic as well) before launch.
 * Set LEGAL_REVIEWED=true once approved to remove the draft notice.
 */

export type LegalContext = {
  brand: string;
  legalName: string;
  licence: string;
  authority: string;
  trn: string | null;
  address: string;
  email: string;
  phone: string;
};

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

export const LEGAL_SLUGS = ["terms", "privacy", "refunds", "delivery"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function legalDoc(slug: LegalSlug, c: LegalContext): LegalDoc {
  const who = `${c.legalName} (trading as ${c.brand}), licensed by ${c.authority} under trade licence ${c.licence}, ${c.address}`;
  switch (slug) {
    case "terms":
      return {
        title: "Terms of ordering",
        intro: `These terms apply when you order food for delivery from ${c.brand} on this website. The seller is ${who}.`,
        sections: [
          {
            heading: "Who we are",
            body: [
              `This website is operated by ${c.legalName}. The United Arab Emirates is our country of domicile. You can reach us at ${c.email} or ${c.phone}.`,
              ...(c.trn ? [`VAT registration (TRN): ${c.trn}.`] : []),
            ],
          },
          {
            heading: "Placing an order",
            body: [
              "Your order is an offer to buy the dishes in your basket at the prices shown at checkout. A contract is formed when the kitchen accepts your order — you'll see “Confirmed” on your tracking page.",
              "We may decline an order, for example if a dish has sold out, your address is outside our delivery area, or we cannot reach you. If you paid online, any declined order is refunded in full.",
              "You must be 18 or older to place an order, and the details you give us must be accurate.",
            ],
          },
          {
            heading: "Prices and payment",
            body: [
              "Prices are in UAE dirhams (AED) and include VAT unless shown otherwise. Delivery fees, any service fee and any discount are shown before you place your order.",
              "We accept the payment methods shown at checkout. We do not charge extra for paying by card. Online payments are processed by our licensed payment provider on their secure page; we never see or store your card number.",
              "We do not trade with or ship to countries or persons sanctioned under UAE law or by OFAC.",
            ],
          },
          {
            heading: "Delivery",
            body: [
              "Delivery areas, fees, minimum order values and estimated times are shown before checkout and in our Delivery policy. Estimated times are estimates; we will tell you if your order is running late.",
              "Please make sure someone is available at the address and phone number you give us.",
            ],
          },
          {
            heading: "Allergies",
            body: [
              "Ingredients and allergens are listed on each dish where available. Our kitchen handles common allergens and we cannot guarantee any dish is free from traces. If you have an allergy, please contact us before ordering.",
            ],
          },
          {
            heading: "Cancellations, refunds and complaints",
            body: [
              "See our Cancellation & refund policy. If something isn't right, contact us within 24 hours of delivery with your order number and we'll make it right. Nothing in these terms limits your rights under UAE consumer-protection law.",
            ],
          },
          {
            heading: "Governing law",
            body: ["These terms are governed by the laws of the United Arab Emirates as applied in the Emirate of Dubai, and the Dubai courts have jurisdiction."],
          },
        ],
      };
    case "refunds":
      return {
        title: "Cancellation & refund policy",
        intro: "Because we cook fresh food to order, cancellations and refunds work a little differently from other purchases. Here's exactly how.",
        sections: [
          {
            heading: "Cancelling your order",
            body: [
              `You can cancel free of charge until the kitchen accepts your order. After that, please call us on ${c.phone} as soon as possible — if cooking hasn't started we'll cancel it and refund you in full.`,
              "Once your food is being prepared or is on its way, we can't usually cancel it, because it can't be resold.",
            ],
          },
          {
            heading: "If we cancel",
            body: ["If we decline or cancel your order for any reason (for example a dish sold out or delivery isn't possible), you won't be charged, and any online payment is refunded in full."],
          },
          {
            heading: "Wrong, missing, damaged or very late orders",
            body: [
              "Tell us within 24 hours of delivery with your order number and, where helpful, a photo. Depending on what happened we'll redeliver the item, refund the affected items (and delivery fee where appropriate), or offer a credit — your choice where reasonable.",
            ],
          },
          {
            heading: "How refunds are paid",
            body: [
              "Online payments are refunded to the original card. Refunds are issued within 5 working days of approval; your bank may take a further 5–14 days to show them.",
              "Cash-on-delivery refunds are made by bank transfer or as agreed with you.",
            ],
          },
          {
            heading: "Complaints",
            body: [`Email ${c.email} or call ${c.phone}. We aim to reply within one working day.`],
          },
        ],
      };
    case "delivery":
      return {
        title: "Delivery policy",
        intro: `${c.brand} delivers freshly cooked food from our Dubai kitchen to the areas listed at checkout.`,
        sections: [
          {
            heading: "Where and when",
            body: [
              "Choose your area when you start an order to see whether we deliver there, the delivery fee, the minimum order and the estimated delivery time. Online ordering is available during our delivery hours shown on the ordering page.",
            ],
          },
          {
            heading: "Fees and minimum order",
            body: ["Delivery fees and minimum order values depend on your area and are always shown before you pay. Some areas get free delivery above a set order value."],
          },
          {
            heading: "Food safety in transit",
            body: [
              "Orders are packed in sealed, tamper-evident packaging and carried in insulated, food-grade delivery boxes, with hot and cold items kept apart, in line with Dubai Municipality requirements for food delivery.",
            ],
          },
          {
            heading: "On arrival",
            body: [
              "Our rider will call the mobile number you provide on arrival. If we can't reach you after reasonable attempts, we may have to return the order to the kitchen; please see our refund policy for how this is handled.",
            ],
          },
          {
            heading: "Tracking",
            body: ["After ordering you get a link to follow your order from the kitchen to your door, with status updates as they happen."],
          },
        ],
      };
    case "privacy":
      return {
        title: "Privacy policy",
        intro: `This policy explains how ${c.legalName} (“${c.brand}”, “we”) uses personal data when you order from us, in line with UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data.`,
        sections: [
          {
            heading: "What we collect",
            body: [
              "Name, mobile number and (optionally) email; your delivery address and instructions; if you choose “use my location”, your approximate location to suggest your area; your order and payment status. We never receive or store card numbers — online payments are handled by our payment provider.",
            ],
          },
          {
            heading: "Why we use it",
            body: [
              "To take, prepare, deliver and support your order (this is necessary to perform our contract with you); to keep records required by law, including tax records; and to prevent fraud and abuse.",
              "We send marketing only if you tick the box at checkout, and you can opt out at any time by contacting us.",
            ],
          },
          {
            heading: "Who we share it with",
            body: [
              "Our delivery riders or delivery partner (name, phone, address); our payment provider (to process online payments); and service providers who host our website, database and email on our behalf under confidentiality obligations. We don't sell your data.",
            ],
          },
          {
            heading: "On your device",
            body: [
              "If you choose, this website remembers your basket, details and saved addresses in your browser's local storage on your own device so you don't have to retype them. You can clear them anytime by clearing your browser data. We use an essential cookie for staff sign-in only.",
            ],
          },
          {
            heading: "How long we keep it",
            body: ["Order records are kept for as long as UAE law requires for accounting and tax purposes (typically five years); marketing preferences until you change them."],
          },
          {
            heading: "Your rights",
            body: [`You can ask to access, correct or delete your personal data, or object to marketing, by emailing ${c.email}. We'll respond within the time the law allows.`],
          },
        ],
      };
  }
}
