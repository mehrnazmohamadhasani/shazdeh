import { prisma } from "@/lib/prisma";
import { serverError } from "@/lib/api";
import { hasInvoice, renderInvoice } from "@/lib/ordering/invoice";
import { getInvoiceSeller } from "@/lib/ordering/invoice-seller";

/**
 * The customer's tax invoice (Arabic + English), from the link on the
 * tracking page and in the order emails. The tracking token is the key.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const [order, seller] = await Promise.all([
      prisma.order.findUnique({
        where: { trackingToken: token.slice(0, 64) },
        select: {
          number: true,
          status: true,
          placedAt: true,
          paymentMethod: true,
          paymentStatus: true,
          subtotalFils: true,
          deliveryFeeFils: true,
          serviceFeeFils: true,
          discountFils: true,
          vatFils: true,
          totalFils: true,
          couponCode: true,
          items: {
            select: {
              name: true,
              nameAr: true,
              portion: true,
              quantity: true,
              unitPriceFils: true,
              lineTotalFils: true,
              modifiers: true,
              // Orders from before Arabic names were kept on the line.
              menuItem: { select: { nameAr: true } },
            },
          },
        },
      }),
      getInvoiceSeller(),
    ]);
    if (!order || !hasInvoice(order.status)) {
      return new Response("No invoice for this order.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    const items = order.items.map(({ menuItem, ...i }) => ({ ...i, nameAr: i.nameAr ?? menuItem?.nameAr ?? null }));
    return new Response(renderInvoice({ ...order, items }, seller), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
    });
  } catch (e) {
    return serverError(e);
  }
}
