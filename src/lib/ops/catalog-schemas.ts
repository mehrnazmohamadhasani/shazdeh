import { z } from "zod";

/** Request bodies for supplier, ingredient and stock endpoints (shared with the forms). */

const text = (max: number) => z.string().trim().max(max).nullable().transform((v) => v || null);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const supplierUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  trn: text(30),
  phone: text(40),
  notes: text(1000),
  deliveryDays: z.array(z.number().int().min(0).max(6)).max(7),
  leadTimeDays: z.number().int().min(0).max(60).nullable(),
  paymentTermsDays: z.number().int().min(0).max(365).nullable(),
});

export const mergeSchema = z.object({ intoId: z.string().min(1) });

export const ingredientUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameFa: text(120),
  category: z.enum(["FOOD", "PACKAGING", "SUPPLIES"]),
});

export const movementSchema = z.object({
  type: z.enum(["WASTE", "STAFF_MEAL", "ADJUSTMENT"]),
  /** In the ingredient's unit (g / ml / pcs). */
  quantity: z.number().finite().refine((v) => v !== 0, "Enter an amount"),
  day,
  note: text(300),
});

export const countSchema = z.object({
  day,
  counts: z.array(z.object({ ingredientId: z.string().min(1), counted: z.number().finite().min(0) })).min(1).max(500),
});

export const openingSchema = z.object({
  day,
  rows: z
    .array(
      z.object({
        /** Existing ingredient, or null to find/create one by name. */
        ingredientId: z.string().nullable(),
        name: z.string().trim().min(1).max(120),
        unit: z.enum(["g", "ml", "pcs"]),
        category: z.enum(["FOOD", "PACKAGING", "SUPPLIES"]),
        /** In the ingredient's unit (g / ml / pcs). */
        quantity: z.number().finite().positive(),
        /** Value of the whole row in AED, ex VAT; null when unknown. */
        value: z.number().finite().min(0).nullable(),
      }),
    )
    .min(1)
    .max(1000),
});

// ─── Recipes ────────────────────────────────────────────────────────────────

const recipeUnit = z.enum(["G", "ML", "PCS"]);

export const recipeCreateSchema = z.object({
  kind: z.enum(["DISH", "PREP"]),
  menuItemId: z.string().min(1).nullable(),
  name: text(120),
  nameFa: text(120),
  yieldUnit: recipeUnit.default("G"),
});

export const recipeDetailsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameFa: text(120),
});

export const recipeDraftSchema = z.object({
  /** Ignored for dishes (always one portion). */
  yieldQuantity: z.number().finite().positive().max(1_000_000),
  yieldUnit: recipeUnit,
  note: text(500),
  lines: z
    .array(
      z
        .object({
          ingredientId: z.string().min(1).nullable(),
          subRecipeId: z.string().min(1).nullable(),
          /** In the ingredient's unit or the prep's yield unit (g / ml / pcs). */
          quantity: z.number().finite().positive().max(1_000_000),
          wastePct: z.number().finite().min(0).max(95),
          note: text(200),
        })
        .refine((l) => (l.ingredientId == null) !== (l.subRecipeId == null), "Each line needs an ingredient or a prep"),
    )
    .max(80),
});
