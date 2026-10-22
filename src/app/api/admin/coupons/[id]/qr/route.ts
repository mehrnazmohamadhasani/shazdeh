import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { notFound, requireAuth, serverError } from "@/lib/api";
import { absoluteUrl } from "@/lib/seo";
import { qrSvg } from "@/lib/qr";
import { giftScanPath } from "@/lib/ordering/gift-utils";
import { giftCardSvg } from "@/lib/ordering/gift-card";

/**
 * The gift's QR for printing: ?format=svg (default) | png (1024 px) |
 * card (the A6 bag card, SVG). &download=1 saves it as a file.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const format = params.get("format") ?? "svg";
  try {
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon || !coupon.isGift) return notFound();
    const url = absoluteUrl(giftScanPath(coupon.code));
    const name = `shazdeh-gift-${coupon.code.toLowerCase()}`;
    const headers = (type: string, ext: string): HeadersInit => ({
      "Content-Type": type,
      "Cache-Control": "private, no-store",
      ...(params.get("download") ? { "Content-Disposition": `attachment; filename="${name}${ext}"` } : {}),
    });

    if (format === "card") {
      const svg = giftCardSvg({ url, domain: new URL(url).host.replace(/^www\./, ""), ...coupon });
      return new Response(svg, { headers: headers("image/svg+xml", "-card.svg") });
    }
    if (format === "png") {
      const png = await sharp(Buffer.from(qrSvg(url)))
        .resize(1024, 1024, { kernel: "nearest" })
        .png()
        .toBuffer();
      return new Response(new Uint8Array(png), { headers: headers("image/png", ".png") });
    }
    return new Response(qrSvg(url), { headers: headers("image/svg+xml", ".svg") });
  } catch (e) {
    return serverError(e);
  }
}
