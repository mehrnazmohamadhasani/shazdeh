/*
 * Delivery providers. The order flow never talks to a courier directly —
 * it calls `dispatch()` on whichever provider staff pick when they send
 * an order out, so the restaurant can run its own riders, a logistics
 * partner, or both, and change that later without touching checkout.
 *
 * Today both providers record what staff enter (rider name/phone, or the
 * courier's booking reference and tracking link). A courier with an API
 * (e.g. a 3PL that accepts dispatch requests) becomes a third entry that
 * books the job itself and returns the same fields.
 */

export type DispatchInput = {
  driverName?: string | null;
  driverPhone?: string | null;
  deliveryRef?: string | null;
  trackingUrl?: string | null;
};

export type DispatchResult = {
  deliveryProvider: string;
  driverName: string | null;
  driverPhone: string | null;
  deliveryRef: string | null;
  trackingUrl: string | null;
};

export type DeliveryProvider = {
  id: string;
  label: string;
  description: string;
  dispatch(input: DispatchInput): Promise<DispatchResult>;
};

const ownFleet: DeliveryProvider = {
  id: "own_fleet",
  label: "Own rider",
  description: "A SHĀZDEH rider delivers the order.",
  async dispatch(input) {
    return {
      deliveryProvider: "own_fleet",
      driverName: input.driverName?.trim() || null,
      driverPhone: input.driverPhone?.trim() || null,
      deliveryRef: null,
      trackingUrl: null,
    };
  },
};

const courier: DeliveryProvider = {
  id: "courier",
  label: "Courier partner",
  description: "Booked with a logistics partner; paste their reference and tracking link.",
  async dispatch(input) {
    return {
      deliveryProvider: "courier",
      driverName: input.driverName?.trim() || null,
      driverPhone: input.driverPhone?.trim() || null,
      deliveryRef: input.deliveryRef?.trim() || null,
      trackingUrl: input.trackingUrl?.trim() || null,
    };
  },
};

export const DELIVERY_PROVIDERS: DeliveryProvider[] = [ownFleet, courier];

export function getDeliveryProvider(id: string): DeliveryProvider | null {
  return DELIVERY_PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Which providers to offer at dispatch for the configured delivery model. */
export function providersForModel(model: "OWN_FLEET" | "THIRD_PARTY" | "HYBRID") {
  if (model === "OWN_FLEET") return [ownFleet];
  if (model === "THIRD_PARTY") return [courier];
  return DELIVERY_PROVIDERS;
}
