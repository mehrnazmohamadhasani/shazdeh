import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ORDER_ROLES, notFound, requireAuth, serverError } from "@/lib/api";
import { getInvoiceSeller } from "@/lib/ordering/invoice-seller";
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
    const [order, seller] = await Promise.all([
      // The dish's Arabic name for lines saved before it was kept on the line.
      prisma.order.findUnique({ where: { id }, include: { items: { include: { menuItem: { select: { nameAr: true } } } } } }),
      getInvoiceSeller(),
    ]);
    if (!order) return notFound();
    const items = order.items.map(({ menuItem, ...i }) => ({ ...i, nameAr: i.nameAr ?? menuItem?.nameAr ?? null }));
    const html = renderTickets({ ...order, items }, seller, copies, sp.get("auto") === "1");
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
