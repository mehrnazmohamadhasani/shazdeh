import { qrMatrix, qrPath } from "@/lib/qr";
import { offerLabel } from "@/lib/ordering/gift-utils";

/*
 * The printable gift card that goes in the food bag: A6 (105 × 148 mm),
 * SHĀZDEH colours, the QR and the offer. An SVG, so it prints sharp at
 * any size and the browser supplies the fonts.
 */

const esc = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function giftCardSvg(gift: {
  url: string;
  domain: string;
  type: "PERCENT" | "FIXED" | "FREE_DELIVERY";
  value: number;
}): string {
  const W = 1050;
  const H = 1480;
  const matrix = qrMatrix(gift.url);
  const quiet = 3; // the white box around the code adds the rest of the quiet zone
  const units = matrix.length + quiet * 2;
  const qrSize = 520;
  const qrX = (W - qrSize) / 2;
  const qrY = 560;
  const font = `font-family="Inter, 'Helvetica Neue', Arial, sans-serif"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="105mm" height="148mm" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#fdf6ec"/>
<rect x="30" y="30" width="${W - 60}" height="${H - 60}" rx="36" fill="none" stroke="#ce4927" stroke-width="4"/>
<text x="${W / 2}" y="170" text-anchor="middle" ${font} font-size="54" font-weight="700" letter-spacing="14" fill="#ce4927">SHĀZDEH</text>
<text x="${W / 2}" y="270" text-anchor="middle" ${font} font-size="40" fill="#494e54">A little gift for you</text>
<text x="${W / 2}" y="400" text-anchor="middle" ${font} font-size="120" font-weight="800" letter-spacing="-4" fill="#000">${esc(offerLabel(gift.type, gift.value))}</text>
<text x="${W / 2}" y="475" text-anchor="middle" ${font} font-size="40" fill="#000">on your next order at ${esc(gift.domain)}</text>
<rect x="${qrX - 20}" y="${qrY - 20}" width="${qrSize + 40}" height="${qrSize + 40}" rx="28" fill="#fff"/>
<svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" viewBox="0 0 ${units} ${units}" shape-rendering="crispEdges"><path fill="#000" d="${qrPath(matrix, quiet)}"/></svg>
<text x="${W / 2}" y="${qrY + qrSize + 110}" text-anchor="middle" ${font} font-size="48" font-weight="700" fill="#000">Nooshe jan!</text>
<text x="${W / 2}" y="${qrY + qrSize + 170}" text-anchor="middle" ${font} font-size="36" fill="#494e54">Scan to unlock your gift</text>
</svg>`;
}
