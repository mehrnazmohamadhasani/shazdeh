/*
 * The "on its way" delivery scooter, drawn once and shared by the
 * tracking page (inline SVG) and scripts/generate-push-icons.ts (PNG
 * icons for push notifications and email). Facing right, viewBox 96×64.
 */

export type ScooterColors = {
  body: string;
  wheel: string;
  rim: string;
  box: string;
  mark: string;
  light: string;
};

export const SCOOTER_VIEWBOX = "0 0 96 64";

export function scooterMarkup(c: ScooterColors) {
  return `
<rect x="10" y="12" width="30" height="24" rx="5" fill="${c.box}"/>
<path d="M20 31v-7a5 5 0 0 1 10 0v7" fill="none" stroke="${c.mark}" stroke-width="3" stroke-linecap="round"/>
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
export function scooterSvg(c: ScooterColors, { size = 96, background }: { size?: number; background?: string } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 -12 96 96">
${background ? `<rect x="0" y="-12" width="96" height="96" fill="${background}"/>` : ""}
${scooterMarkup(c)}
</svg>`;
}
