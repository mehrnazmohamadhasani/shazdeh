import qrcode from "qrcode-generator";

/*
 * QR codes as SVG, drawn on the server. One <path> for all dark modules
 * keeps the file small and crisp at any print size; PNGs are rendered
 * from this SVG with sharp.
 */

export type QrOptions = {
  /** Quiet zone around the code, in modules. Scanners need at least 4. */
  margin?: number;
  dark?: string;
  light?: string | null;
};

/** The QR as a module grid (true = dark). */
export function qrMatrix(text: string): boolean[][] {
  // "M" recovers ~15% damage: plenty for a printed card, still a small code.
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Path data for the dark modules, one unit per module, offset by `margin`. */
export function qrPath(matrix: boolean[][], margin = 0): string {
  const parts: string[] = [];
  matrix.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < row.length && row[c]) c++;
      parts.push(`M${start + margin} ${r + margin}h${c - start}v1h${start - c}z`);
    }
  });
  return parts.join("");
}

export function qrSvg(text: string, { margin = 4, dark = "#000000", light = "#ffffff" }: QrOptions = {}): string {
  const matrix = qrMatrix(text);
  const size = matrix.length + margin * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${
    light ? `<rect width="${size}" height="${size}" fill="${light}"/>` : ""
  }<path fill="${dark}" d="${qrPath(matrix, margin)}"/></svg>`;
}
