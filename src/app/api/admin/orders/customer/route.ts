import { type NextRequest } from "next/server";
import { ORDER_ROLES, ok, requireAuth, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { normalizeMobile } from "@/lib/ordering/phone";
import { getDeliveryNetwork } from "@/lib/ordering/zones";

/**
 * A returning customer, by phone: name and the address of their latest
 * order, so a WhatsApp or phone order is quick to enter. Null when the
 * number is new.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(ORDER_ROLES);
  if (auth.response) return auth.response;
  const phone = normalizeMobile(req.nextUrl.searchParams.get("phone")?.slice(0, 32) ?? "");
  if (!phone) return ok({ customer: null });
  try {
    const [last, network] = await Promise.all([
      prisma.order.findFirst({
        where: { customerPhone: phone, status: { not: "PENDING_PAYMENT" } },
        orderBy: { placedAt: "desc" },
        select: {
          customerName: true,
          customerEmail: true,
          areaName: true,
          addressType: true,
          building: true,
          street: true,
          unit: true,
          floor: true,
          instructions: true,
          lat: true,
          lng: true,
          placedAt: true,
        },
      }),
      getDeliveryNetwork(),
    ]);
    if (!last) return ok({ customer: null });
    const area = network.areas.find((a) => a.name === last.areaName) ?? null;
    return ok({
      customer: {
        name: last.customerName,
        email: last.customerEmail,
        lastOrderAt: last.placedAt.toISOString(),
        address: {
          areaId: area?.id ?? null,
          addressType: last.addressType,
          building: last.building,
          street: last.street,
          unit: last.unit,
          floor: last.floor,
          instructions: last.instructions,
          lat: last.lat,
          lng: last.lng,
        },
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
