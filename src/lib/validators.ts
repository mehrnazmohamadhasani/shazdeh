import { z } from "zod";

const slugRegex = /^[a-z0-9-]+$/;

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(slugRegex, "Slug must be lowercase letters, numbers and dashes only");

/**
 * Links rendered as href on the public site. Only http(s), mailto, tel
 * and site-relative paths — never javascript: or data: URLs.
 */
const safeHref = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      (v.startsWith("/") && !v.startsWith("//")) ||
      /^(https?:|mailto:|tel:)/i.test(v),
    "Use a full https:// link, mailto:, tel:, or a path starting with /",
  );

/** Image sources: uploaded paths or https URLs. */
const imageSrc = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (v) => (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\//i.test(v),
    "Images must be an uploaded file or an https:// URL",
  );

/** Optional field where an empty string means "cleared" → null. */
const optional = <T extends z.ZodType<string>>(schema: T) =>
  schema
    .or(z.literal(""))
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));

/**
 * PATCH schemas: every field optional and — crucially — no defaults.
 * zod's .partial() keeps `.default()`, so a PATCH of { isAvailable }
 * would otherwise reset every other flag to its default.
 */
function updateSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => {
      const inner =
        field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : field;
      return [key, (inner as z.ZodType).optional()];
    }),
  );
  return z.object(shape) as unknown as ReturnType<z.ZodObject<T>["partial"]>;
}

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const categorySchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(100),
  tagline: optionalText(200),
  description: optionalText(2000),
  imageUrl: optional(imageSrc),
  order: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const categoryUpdateSchema = updateSchema(categorySchema);

export const menuItemSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
  nameFa: optionalText(120),
  description: optionalText(1500),
  story: optionalText(2500),
  price: z.number().nonnegative().max(100000),
  currency: z.string().trim().min(1).max(8).default("AED"),
  imageUrl: optional(imageSrc),
  categoryId: z.string().min(1),
  ingredients: optionalText(1500),
  allergens: optionalText(500),
  spicyLevel: z.number().int().min(0).max(3).optional().default(0),
  isVegetarian: z.boolean().optional().default(false),
  isAvailable: z.boolean().optional().default(true),
  isBestseller: z.boolean().optional().default(false),
  isNew: z.boolean().optional().default(false),
  isSignature: z.boolean().optional().default(false),
  order: z.number().int().nonnegative().optional().default(0),
});

export const menuItemUpdateSchema = updateSchema(menuItemSchema);

export const bannerSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: optionalText(280),
  ctaLabel: optionalText(60),
  ctaHref: optional(safeHref),
  imageUrl: imageSrc,
  position: z.string().trim().min(1).max(40).default("home_hero"),
  order: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const bannerUpdateSchema = updateSchema(bannerSchema);

export const galleryImageSchema = z.object({
  title: optionalText(160),
  caption: optionalText(500),
  imageUrl: imageSrc,
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  order: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const galleryImageUpdateSchema = updateSchema(galleryImageSchema);

export const socialLinkSchema = z.object({
  platform: z.string().trim().toLowerCase().min(1).max(40),
  label: z.string().trim().min(1).max(60),
  url: safeHref,
  icon: optionalText(60),
  order: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const socialLinkUpdateSchema = updateSchema(socialLinkSchema);

/** Opening hours are stored as a JSON object of day → hours string. */
const openingHours = z
  .string()
  .max(2000)
  .refine((v) => {
    if (v.trim() === "") return true;
    try {
      const o = JSON.parse(v) as unknown;
      return (
        !!o &&
        typeof o === "object" &&
        !Array.isArray(o) &&
        Object.values(o).every((x) => typeof x === "string")
      );
    } catch {
      return false;
    }
  }, 'Opening hours must be JSON like {"mon":"11:00 — 22:45"}');

export const settingsUpdateSchema = z.object({
  brandName: z.string().trim().min(1).max(60).optional(),
  tagline: optionalText(200),
  description: optionalText(2000),
  email: optional(z.email()),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  address: optionalText(500),
  mapUrl: optional(safeHref),
  openingHours: openingHours.nullable().optional(),
  heroVideoUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === "" || /^https:\/\//i.test(v) || v.startsWith("/"), "Use an https:// video URL")
    .nullable()
    .optional(),
  logoUrl: optional(imageSrc),
  faviconUrl: optional(imageSrc),
  metaTitle: optionalText(160),
  metaDesc: optionalText(280),
  ogImageUrl: optional(imageSrc),
});
