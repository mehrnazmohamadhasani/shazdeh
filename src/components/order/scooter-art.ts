/*
 * The "on its way" delivery scooter carrying a SHĀZDEH package (the
 * brand "S" from the app icon on the box). Drawn once and shared by the
 * tracking page (inline SVG) and scripts/generate-push-icons.ts (PNG
 * icons for push notifications and email). Facing right, viewBox 96×64.
 */

export type ScooterColors = {
  body: string;
  wheel: string;
  rim: string;
  box: string;
  /** The "S" on the box. */
  mark: string;
  light: string;
};

export const SCOOTER_VIEWBOX = "0 0 96 64";

/** White "S" on transparent, cut from the app icon by scripts/generate-push-icons.ts. */
export const S_GLYPH_PATH = "/brand/s-glyph.png";
const S_ASPECT = 439 / 697;

/**
 * `id` keeps the glyph mask unique when several scooters share a page;
 * `glyphHref` is the "S" image (a data: URI when rasterising).
 */
export function scooterMarkup(c: ScooterColors, { id = "s", glyphHref = S_GLYPH_PATH }: { id?: string; glyphHref?: string } = {}) {
  const mask = `szs-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const gh = 18;
  const gw = gh * S_ASPECT;
  const gx = 24 - gw / 2;
  const gy = 16.5;
  return `
<defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="96" height="64"><image href="${glyphHref}" x="${gx}" y="${gy}" width="${gw}" height="${gh}"/></mask></defs>
<rect x="6" y="6" width="36" height="31" rx="5" fill="${c.box}"/>
<path d="M11 6h26a5 5 0 0 1 5 5v3H6v-3a5 5 0 0 1 5-5z" fill="#000" fill-opacity=".16"/>
<rect x="6" y="6" width="36" height="31" fill="${c.mark}" mask="url(#${mask})"/>
<path d="M12 46c0-6.5 4.5-10 11-10h27c4 0 6.5 2.5 8.5 6.5L61 48H12z" fill="${c.body}"/>
<rect x="36" y="44" width="30" height="5" rx="2.5" fill="${c.body}"/>
<path d="M63 47 69 20" stroke="${c.rim}" stroke-width="4.5" stroke-linecap="round"/>
<path d="M63 18h11" stroke="${c.rim}" stroke-width="4" stroke-linecap="round"/>
<path d="M66 40c6-3.5 14-2.5 18 3" fill="none" stroke="${c.body}" stroke-width="4" stroke-linecap="round"/>
<circle cx="72" cy="27" r="3" fill="${c.light}"/>
<circle cx="25" cy="51" r="9" fill="${c.wheel}" stroke="${c.rim}" stroke-width="3"/>
<circle cx="25" cy="51" r="3" fill="${c.rim}"/>
<circle cx="76" cy="51" r="9" fill="${c.wheel}" stroke="${c.rim}" stroke-width="3"/>
<circle cx="76" cy="51" r="3" fill="${c.rim}"/>`;
}

/** Full standalone SVG document (for rasterising): square, scooter centred. */
export function scooterSvg(
  c: ScooterColors,
  { size = 96, background, glyphHref }: { size?: number; background?: string; glyphHref?: string } = {},
) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 -14 96 96">
${background ? `<rect x="0" y="-14" width="96" height="96" fill="${background}"/>` : ""}
${scooterMarkup(c, { glyphHref })}
</svg>`;
}
