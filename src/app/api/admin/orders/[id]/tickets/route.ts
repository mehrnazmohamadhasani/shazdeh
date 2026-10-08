import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ORDER_ROLES, notFound, requireAuth, serverError } from "@/lib/api";
import { getOrderingSettings } from "@/lib/ordering/config";
import { renderTickets, type TicketCopy } from "@/lib/ordering/tickets";

/**
 * Kitchen + delivery tickets as printable HTML.
 *   ?copy=kitchen|delivery   one copy (default: both)
 *   ?auto=1                  open the print dialog on load
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(ORDER_ROLES);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const copy = sp.get("copy");
  const copies: TicketCopy[] = copy === "kitchen" || copy === "delivery" ? [copy] : ["kitchen", "delivery"];
  try {
    const [order, settings] = await Promise.all([
      prisma.order.findUnique({ where: { id }, include: { items: true } }),
      getOrderingSettings(),
    ]);
    if (!order) return notFound();
    const html = renderTickets(order, settings, copies, sp.get("auto") === "1");
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
