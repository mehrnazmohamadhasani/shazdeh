/*
 * View models shared by the ordering server loaders and client UI.
 * No server-only imports here.
 */
import type { PricingGroup, PricingItem, ZoneTerms } from "@/lib/ordering/pricing";

/** One orderable portion of a product ("Fesenjan — Large"). */
export type OrderVariant = {
  itemId: string;
  slug: string;
  portion: string | null;
  priceFils: number;
  orderable: boolean;
  groups: PricingGroup[];
};

/**
 * A product as customers think of it. Portions that the menu stores as
 * separate dishes ("Sabzi Khordan — Small" / "— Large") are folded into
 * one product with a size choice.
 */
export type OrderProduct = {
  key: string;
  title: string;
  nameFa: string | null;
  description: string | null;
  ingredients: string | null;
  allergens: string | null;
  imageUrl: string | null;
  isVegetarian: boolean;
  isSignature: boolean;
  isBestseller: boolean;
  isNew: boolean;
  spicyLevel: number;
  categorySlug: string;
  categoryName: string;
  fromPriceFils: number;
  variants: OrderVariant[];
};

export type OrderCategory = {
  slug: string;
  name: string;
  tagline: string | null;
  products: OrderProduct[];
};

export type OrderArea = {
  id: string;
  name: string;
  zoneId: string;
  lat: number | null;
  lng: number | null;
};

export type OrderZone = ZoneTerms;

export type OrderingConfig = {
  acceptingOrders: boolean;
  pausedMessage: string | null;
  kitchenOpen: boolean;
  kitchenLabel: string;
  canOrder: boolean;
  vatRate: number;
  pricesIncludeVat: boolean;
  serviceFeeFils: number;
  paymentMethods: ("CASH_ON_DELIVERY" | "CARD_ON_DELIVERY" | "ONLINE")[];
  onlineProviderLabel: string | null;
  cutleryDefault: boolean;
  prepMinutes: number;
};

export function variantToPricingItem(product: OrderProduct, v: OrderVariant): PricingItem {
  return {
    id: v.itemId,
    name: product.title,
    portion: v.portion,
    priceFils: v.priceFils,
    orderable: v.orderable,
    groups: v.groups,
  };
}
