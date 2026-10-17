/*
 * Shapes shared by the assistant's server code and its screen: what a
 * proposed change looks like before it is confirmed, and who may do what.
 * Pure, so the browser can import it too.
 */

export type ItemRef = { id: string; name: string; nameFa: string | null; unit: "G" | "ML" | "PCS" };

/** A figure that is either known or not: never a made-up number. */
export type Fils = number | null;

export type StockPreview = {
  kind: "stock";
  type: "WASTE" | "STAFF_MEAL" | "ADJUSTMENT";
  item: ItemRef;
  day: string;
  /** Signed, in the item's unit. */
  quantity: number;
  before: number;
  after: number;
  /** Estimated from the last purchase price; null when there is none. */
  valueFils: Fils;
  note: string | null;
};

export type CountPreview = {
  kind: "count";
  day: string;
  rows: { item: ItemRef; before: number; after: number; valueFils: Fils; big: boolean }[];
};

export type RecipePreview = {
  kind: "recipe";
  /** yieldUnit: a dish is per portion (PCS); a prep's cost is per g / ml / pc of what it makes. */
  recipe: { id: string; name: string; nameFa: string | null; kind: "DISH" | "PREP"; yieldUnit: "G" | "ML" | "PCS" };
  /** The approved version it changes (null: none yet), and whether this person may approve. */
  fromVersion: number | null;
  approve: boolean;
  changes: { item: { name: string; nameFa: string | null }; unit: "G" | "ML" | "PCS"; before: number | null; after: number | null }[];
  cost: { beforeFils: Fils; afterFils: Fils; verified: boolean };
  /** Dishes only: menu price and food-cost share before/after. */
  menuPriceFils: Fils;
  foodCostPct: { before: number | null; after: number | null };
  note: string | null;
};

/** A new dish recipe, dictated: each line as said and what it matched; saved as a draft. */
export type NewRecipePreview = {
  kind: "new_recipe";
  dish: { id: string; name: string; nameFa: string | null };
  /** The amounts were said for this many portions; `rows` are per portion. */
  portions: number;
  rows: { said: string; item: { name: string; nameFa: string | null }; unit: "G" | "ML" | "PCS"; quantity: number }[];
  /** Per portion; null when an ingredient has no price yet (named in `missingPrices`). */
  cost: { perPortionFils: Fils; verified: boolean; missingPrices: string[] };
  menuPriceFils: Fils;
  foodCostPct: number | null;
  note: string | null;
};

export type InvoicePreview = {
  kind: "invoice";
  invoice: { id: string; supplier: string; invoiceNo: string | null; day: string };
  line: { rawName: string; quantity: number; unit: string | null; item: { name: string; nameFa: string | null } | null };
  unitPrice: { beforeFils: Fils; afterFils: number };
  lineTotal: { beforeFils: number; afterFils: number };
  total: { beforeFils: number; afterFils: number };
};

export type FreeFoodPreview = {
  kind: "free_food";
  type: "STAFF_MEAL" | "GIFT" | "TASTING" | "COMPENSATION";
  day: string;
  recipient: string | null;
  reason: string | null;
  lines: { name: string; nameFa: string | null; quantity: number; unitCostFils: Fils; menuPriceFils: number }[];
  /** Null when any dish has no cost from an approved recipe. */
  costFils: Fils;
  menuValueFils: number;
};

export type Preview = StockPreview | CountPreview | RecipePreview | NewRecipePreview | InvoicePreview | FreeFoodPreview;

export const WRITE_TOOLS = ["record_waste", "record_staff_meal", "adjust_stock", "stock_count", "change_recipe", "write_recipe", "fix_invoice_price", "record_free_food"] as const;
export type WriteTool = (typeof WRITE_TOOLS)[number];

export type ActionStatus = "PROPOSED" | "APPLIED" | "CANCELLED" | "UNDONE";

/** One proposed or applied change, as the screen shows it. */
export type ActionCard = {
  id: string;
  tool: WriteTool;
  status: ActionStatus;
  sensitive: boolean;
  via: "chat" | "voice";
  preview: Preview;
  createdAt: string;
  appliedAt: string | null;
  /** Undo is offered for a day after applying. */
  canUndo: boolean;
};

export const UNDO_WINDOW_MS = 24 * 3_600_000;

export type ChatTurn = { role: "user" | "assistant"; text: string };

/** Roles that get the assistant at all (kitchen tablets don't). */
export const ASSISTANT_ROLES = ["ADMIN", "EDITOR", "PURCHASER"] as const;
