/*
 * Pin → readable address ("Bay Square, Al Abraj Street, Business Bay"),
 * so customers see where we'll deliver instead of "Pinned location".
 * OpenStreetMap's Nominatim, called from the server only: free, no key,
 * and its policy asks for an identifying User-Agent and light use, so
 * answers are cached and a slow or failed lookup simply returns null.
 */

/** `building`: the named place at the pin, if any — a starting guess for the building field. */
export type Place = { label: string; street: string | null; building: string | null };

type NominatimAddress = Partial<
  Record<"road" | "house_number" | "neighbourhood" | "suburb" | "quarter" | "city_district" | "city", string>
>;

const cache = new Map<string, Place | null>();
const MAX_CACHED = 500;

/** Builds the label from Nominatim's parts; exported for tests. */
export function placeFromNominatim(body: { name?: string; address?: NominatimAddress } | null): Place | null {
  const a = body?.address;
  if (!a) return null;
  // Dubai addresses go by building and street; house numbers mean little.
  const street = a.road ?? null;
  const district = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? a.city ?? null;
  const name = body?.name && body.name !== a.road && body.name !== district ? body.name : null;
  const parts = [name, street, district].filter((p): p is string => !!p);
  return parts.length ? { label: parts.join(", "), street, building: name } : null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  // ~10 m: close pins share one lookup.
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key)!;
  let place: Place | null = null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SHAZDEH-ordering/1.0 (https://www.shazdeh.ae)" },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    place = placeFromNominatim(await res.json());
  } catch {
    return null;
  }
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, place);
  return place;
}
