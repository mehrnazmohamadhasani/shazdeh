import { z } from "zod";

const slugRegex = /^[a-z0-9-]+$/;

export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(slugRegex, "Slug must be lowercase letters, numbers and dashes only");

export const categorySchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(100),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  order: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const categoryUpdateSchema = categorySchema.partial();

export const menuItemSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(120),
  nameFa: z.string().max(120).nullable().optional(),
  description: z.string().max(1500).nullable().optional(),
  story: z.string().max(2500).nullable().optional(),
  price: z.number().nonnegative(),
  currency: z.string().min(1).max(8).default("AED"),
  imageUrl: z.string().nullable().optional(),
  categoryId: z.string().min(1),
  ingredients: z.string().max(1500).nullable().optional(),
  allergens: z.string().max(500).nullable().optional(),
  spicyLevel: z.number().int().min(0).max(3).optional().default(0),
  isVegetarian: z.boolean().optional().default(false),
  isAvailable: z.boolean().optional().default(true),
  isBestseller: z.boolean().optional().default(false),
  isNew: z.boolean().optional().default(false),
  isSignature: z.boolean().optional().default(false),
  order: z.number().int().nonnegative().optional().default(0),
});

export const menuItemUpdateSchema = menuItemSchema.partial();

export const bannerSchema = z.object({
  title: z.string().min(1).max(160),
  subtitle: z.string().max(280).nullable().optional(),
  ctaLabel: z.string().max(60).nullable().optional(),
  ctaHref: z.string().max(500).nullable().optional(),
  imageUrl: z.string().min(1),
  position: z.string().min(1).max(40).default("home_hero"),
  order: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const bannerUpdateSchema = bannerSchema.partial();

export const galleryImageSchema = z.object({
  title: z.string().max(160).nullable().optional(),
  caption: z.string().max(500).nullable().optional(),
  imageUrl: z.string().min(1),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  order: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const galleryImageUpdateSchema = galleryImageSchema.partial();

export const socialLinkSchema = z.object({
  platform: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  url: z.string().min(1).max(500),
  icon: z.string().max(60).nullable().optional(),
  order: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const socialLinkUpdateSchema = socialLinkSchema.partial();

export const settingsUpdateSchema = z.object({
  brandName: z.string().min(1).max(60).optional(),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().max(40).nullable().optional(),
  whatsapp: z.string().max(40).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  mapUrl: z.string().max(500).nullable().optional(),
  openingHours: z.string().max(2000).nullable().optional(),
  heroVideoUrl: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  metaTitle: z.string().max(160).nullable().optional(),
  metaDesc: z.string().max(280).nullable().optional(),
  ogImageUrl: z.string().nullable().optional(),
});
