import "server-only";
import { getOrderMenu } from "@/lib/ordering/catalog";
import { getOrderingConfig } from "@/lib/ordering/config";
import { getDeliveryNetwork } from "@/lib/ordering/zones";
import type { OrderData } from "@/components/order/order-data";

export async function loadOrderData(): Promise<OrderData> {
  const [categories, network, config] = await Promise.all([
    getOrderMenu(),
    getDeliveryNetwork(),
    getOrderingConfig(),
  ]);
  return { categories, areas: network.areas, zones: network.zones, config };
}
