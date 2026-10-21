import { z } from "zod";
import { SPOKEN_UNITS } from "./match";
import type { WriteTool } from "./types";

/*
 * The assistant's tools: what the model may call, with the arguments it
 * must send (strict JSON schema for the model, the same rules in zod for
 * the server) and the roles that may use each one. The model is only
 * told about the tools the person's role allows, and the server checks
 * again on every call and every confirmation.
 */

type Role = "ADMIN" | "EDITOR" | "STAFF" | "PURCHASER";
const PURCHASING: Role[] = ["ADMIN", "EDITOR", "PURCHASER"];
const MONEY: Role[] = ["ADMIN", "EDITOR"];

const str = (description: string) => ({ type: "string", description });
const nullable = (description: string, type: "string" | "number" | "integer" = "string") => ({ type: [type, "null"], description });
const unit = { type: "string", enum: [...SPOKEN_UNITS], description: "Unit the person said: g, kg, ml, l or pcs." };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const day = z.string().max(10).nullable();
const name = z.string().trim().min(1).max(120);
const zUnit = z.enum(SPOKEN_UNITS);

export const toolArgs = {
  stock_level: z.object({ item: name.nullable() }),
  recent_purchases: z.object({ item: name.nullable(), supplier: name.nullable(), days: z.number().int().min(1).max(62).nullable() }),
  recipe_info: z.object({ recipe: name }),
  today_summary: z.object({ day }),
  sales_summary: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).nullable() }),
  payables: z.object({}),
  record_waste: z.object({ item: name, quantity: z.number().positive().max(1_000_000), unit: zUnit, day, note: z.string().max(300).nullable() }),
  record_staff_meal: z.object({ item: name, quantity: z.number().positive().max(1_000_000), unit: zUnit, day, note: z.string().max(300).nullable() }),
  adjust_stock: z.object({ item: name, quantity: z.number().refine((n) => n !== 0).refine((n) => Math.abs(n) <= 1_000_000), unit: zUnit, reason: z.string().trim().min(1).max(300) }),
  stock_count: z.object({
    counts: z.array(z.object({ item: name, quantity: z.number().min(0).max(1_000_000), unit: zUnit })).min(1).max(60),
    day,
  }),
  change_recipe: z.object({
    recipe: name,
    changes: z.array(z.object({ item: name, quantity: z.number().min(0).max(1_000_000).nullable(), unit: zUnit })).min(1).max(20),
    note: z.string().max(300).nullable(),
  }),
  write_recipe: z.object({
    dish: name,
    portions: z.number().int().min(1).max(200).nullable(),
    lines: z.array(z.object({ item: name, quantity: z.number().positive().max(1_000_000), unit: zUnit })).min(1).max(40),
    note: z.string().max(300).nullable(),
  }),
  record_free_food: z.object({
    kind: z.enum(["STAFF_MEAL", "GIFT", "TASTING", "COMPENSATION"]),
    items: z.array(z.object({ dish: name, quantity: z.number().int().min(1).max(50) })).min(1).max(20),
    recipient: z.string().trim().max(80).nullable(),
    reason: z.string().trim().max(200).nullable(),
    day,
  }),
  fix_invoice_price: z.object({
    lineId: z.string().max(40).nullable(),
    item: name.nullable(),
    supplier: name.nullable(),
    day,
    unitPrice: z.number().positive().max(1_000_000),
  }),
} as const;

export type ToolName = keyof typeof toolArgs;

type Definition = { roles: Role[]; write: boolean; description: string; parameters: object };

export const TOOLS: Record<ToolName, Definition> = {
  stock_level: {
    roles: PURCHASING,
    write: false,
    description:
      "Stock on hand of one ingredient (by name in any language) with its last purchase price however long ago it was bought, or with item null every ingredient with its amount and status (ok, low, out). Use it for \"how much do we have\" and for an ingredient's price. Use null for a full or partial stock list, or for what is low or out.",
    parameters: obj({ item: nullable("Ingredient name, or null for every ingredient.") }),
  },
  recent_purchases: {
    roles: PURCHASING,
    write: false,
    description: "Saved invoice lines of the last days (default 14): date, supplier, item, quantity, unit price. Use it to find an invoice line to correct, or for what was bought lately — not for an ingredient's price (stock_level has it).",
    parameters: obj({
      item: nullable("Ingredient name, or null for all."),
      supplier: nullable("Supplier name, or null for all."),
      days: nullable("How many days back, 1–62; null = 14.", "integer"),
    }),
  },
  recipe_info: {
    roles: MONEY,
    write: false,
    description: "A dish's or prep's approved recipe: each ingredient with its amount, cost per portion, food cost % and margin.",
    parameters: obj({ recipe: str("Dish or prep name in any language.") }),
  },
  today_summary: {
    roles: MONEY,
    write: false,
    description: "One day's sales by channel, estimated food cost and profit, and what needs attention (low stock, invoices to check, credit due).",
    parameters: obj({ day: nullable("YYYY-MM-DD, or null for today.") }),
  },
  sales_summary: {
    roles: MONEY,
    write: false,
    description: "A month's sales and platform fees by channel.",
    parameters: obj({ month: nullable("YYYY-MM, or null for this month.") }),
  },
  payables: {
    roles: MONEY,
    write: false,
    description: "Credit invoices not yet paid, with due dates.",
    parameters: obj({}),
  },
  record_waste: {
    roles: PURCHASING,
    write: true,
    description: "Propose taking thrown-away stock out (spoiled, burnt, dropped). Shown to the person to confirm; nothing changes until they do.",
    parameters: obj({
      item: str("Ingredient name."),
      quantity: { type: "number", description: "Amount, positive." },
      unit,
      day: nullable("YYYY-MM-DD, or null for today."),
      note: nullable("Why, in the person's words, or null."),
    }),
  },
  record_staff_meal: {
    roles: PURCHASING,
    write: true,
    description: "Propose taking stock out for staff meals. Shown to the person to confirm.",
    parameters: obj({
      item: str("Ingredient name."),
      quantity: { type: "number", description: "Amount, positive." },
      unit,
      day: nullable("YYYY-MM-DD, or null for today."),
      note: nullable("Note, or null."),
    }),
  },
  adjust_stock: {
    roles: MONEY,
    write: true,
    description: "Propose a correction to stock that is neither waste, a staff meal nor a count (positive adds, negative takes out). Needs a reason.",
    parameters: obj({
      item: str("Ingredient name."),
      quantity: { type: "number", description: "Signed amount: positive adds, negative takes out." },
      unit,
      reason: str("Why, in the person's words."),
    }),
  },
  stock_count: {
    roles: PURCHASING,
    write: true,
    description: "Propose a stock count: what is actually on the shelf for one or more ingredients. The difference from the books is posted when confirmed.",
    parameters: obj({
      counts: {
        type: "array",
        items: obj({ item: str("Ingredient name."), quantity: { type: "number", description: "Amount counted (0 or more)." }, unit }),
      },
      day: nullable("YYYY-MM-DD, or null for today."),
    }),
  },
  change_recipe: {
    roles: MONEY,
    write: true,
    description:
      "Propose changing amounts in a dish's or prep's approved recipe: set an ingredient or prep to a new amount per portion (per batch for a prep), add one, or remove one (quantity null). Shows the cost before and after; approving makes it the kitchen standard.",
    parameters: obj({
      recipe: str("Dish or prep name."),
      changes: {
        type: "array",
        items: obj({
          item: str("Ingredient or prep name."),
          quantity: { type: ["number", "null"], description: "New amount per portion (dish) or per batch (prep); null removes it." },
          unit,
        }),
      },
      note: nullable("Why, or null."),
    }),
  },
  write_recipe: {
    roles: MONEY,
    write: true,
    description:
      "Propose a NEW recipe for a menu dish that has no recipe yet: every ingredient or prep with its amount, as the person said or dictated it. Amounts are for `portions` portions (null = one portion) and are divided per portion. Each name is matched to the ingredient list (nothing new is created); names that don't match come back to ask about. Saved as a draft that the owner approves on the recipe screen. For a dish that already has an approved recipe use change_recipe.",
    parameters: obj({
      dish: str("Menu dish name, in any language."),
      portions: nullable("How many portions the amounts are for, or null for one portion.", "integer"),
      lines: {
        type: "array",
        items: obj({
          item: str("Ingredient or prep name, as said."),
          quantity: { type: "number", description: "Amount, above 0." },
          unit,
        }),
      },
      note: nullable("Anything else said about the recipe, or null."),
    }),
  },
  record_free_food: {
    roles: PURCHASING,
    write: true,
    description:
      "Propose recording cooked DISHES from the menu that left without a sale: STAFF_MEAL (the team ate them), GIFT (given away: photographer, neighbours, workers), TASTING (tried to check or show a dish), COMPENSATION (given to make up for a complaint). Takes stock by the approved recipes and keeps the cost. For raw ingredients the staff used (bread, rice, a drink) use record_staff_meal instead.",
    parameters: obj({
      kind: { type: "string", enum: ["STAFF_MEAL", "GIFT", "TASTING", "COMPENSATION"], description: "What kind of free food." },
      items: {
        type: "array",
        items: obj({ dish: str("Menu dish name, in any language."), quantity: { type: "integer", description: "Portions, 1 or more." } }),
      },
      recipient: nullable("Who got it (\"photographer\", \"staff lunch\"), or null."),
      reason: nullable("Why, in the person's words, or null."),
      day: nullable("YYYY-MM-DD, or null for today."),
    }),
  },
  fix_invoice_price: {
    roles: PURCHASING,
    write: true,
    description:
      "Propose correcting the unit price (AED) of one line on a saved invoice. Give lineId from recent_purchases when known; otherwise item plus day and/or supplier.",
    parameters: obj({
      lineId: nullable("Invoice line id from recent_purchases, or null."),
      item: nullable("Ingredient or printed item name, or null when lineId is given."),
      supplier: nullable("Supplier name, or null."),
      day: nullable("Invoice date YYYY-MM-DD, or null."),
      unitPrice: { type: "number", description: "The correct unit price in AED, as printed per invoice unit." },
    }),
  },
};

export function toolsFor(role: string): ToolName[] {
  return (Object.keys(TOOLS) as ToolName[]).filter((n) => TOOLS[n].roles.includes(role as Role));
}

export function mayUse(role: string, tool: string): tool is ToolName {
  return tool in TOOLS && TOOLS[tool as ToolName].roles.includes(role as Role);
}

export function isWriteTool(tool: ToolName): tool is ToolName & WriteTool {
  return TOOLS[tool].write;
}

/** The function list the model gets, for this role only. */
export function openAiTools(role: string) {
  return toolsFor(role).map((n) => ({ type: "function", name: n, description: TOOLS[n].description, parameters: TOOLS[n].parameters, strict: true }));
}
