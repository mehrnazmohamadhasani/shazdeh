import { z } from "zod";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);

/** Button and image links: a page on our site ("/order") or a full https link. */
const link = optional(500).refine((v) => !v || v.startsWith("/") || /^https:\/\//i.test(v), {
  message: "Use a link that starts with / or https://",
});

export const campaignSchema = z
  .object({
    subject: z.string().trim().min(3, "Write a subject").max(150),
    previewText: optional(150),
    heading: z.string().trim().min(2, "Write a headline").max(150),
    body: z.string().trim().min(10, "Write the message").max(5000),
    imageUrl: link,
    buttonLabel: optional(40),
    buttonUrl: link,
    promoCode: optional(32),
    audience: z.enum(["marketing", "lapsed", "gift_no_order"]),
  })
  .refine((c) => !c.buttonLabel === !c.buttonUrl, { message: "A button needs both a label and a link", path: ["buttonUrl"] });

export type CampaignInput = z.infer<typeof campaignSchema>;
