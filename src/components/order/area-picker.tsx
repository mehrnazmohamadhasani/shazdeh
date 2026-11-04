"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { Bookmark, Check, LocateFixed, Loader2, MapPin, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cart, savedAddresses, useCart, type SavedAddress } from "@/components/order/cart-store";
import { useOrderData } from "@/components/order/order-data";
import { distanceKm } from "@/lib/ordering/geo";
import { formatFils } from "@/lib/ordering/money";
import { cn } from "@/lib/utils";

/*
 * "Where should we deliver?" — the first question of the order. People
 * in Dubai describe where they live by community, so the picker is a
 * searchable list of the areas the kitchen covers, with fee and timing
 * shown next to each. "Use my location" picks the nearest community;
 * nothing pretends to know an exact street address it can't verify.
 * When the kitchen delivers by distance, customers pin their spot on a
 * map instead and the server says which zone it falls in.
 */

const NEAREST_MAX_KM = 6;
// Where the map opens when we know nothing yet: central Dubai.
const DUBAI = { lat: 25.2048, lng: 55.2708 };

const LocationMap = dynamic(() => import("@/components/order/location-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-cream" />,
});

export function AreaPicker({
  open,
  onOpenChange,
  partners,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: { label: string; url: string }[];
}) {
  const { areas, zoneById, config } = useOrderData();
  const { areaId } = useCart();
  const [query, setQuery] = React.useState("");
  const [locating, setLocating] = React.useState(false);
  const [locateMessage, setLocateMessage] = React.useState<string | null>(null);
  // Read when the sheet opens (client-only; the closed sheet renders nothing).
  const saved = React.useMemo<SavedAddress[]>(
    () => (open ? savedAddresses.list().filter((a) => areas.some((x) => x.id === a.areaId)) : []),
    [open, areas],
  );

  const q = query.trim().toLowerCase();
  const filtered = q ? areas.filter((a) => a.name.toLowerCase().includes(q)) : areas;

  function choose(id: string, coords?: { lat: number; lng: number } | null) {
    cart.setArea(id, coords);
    onOpenChange(false);
    setQuery("");
    setLocateMessage(null);
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocateMessage("Location isn't available on this device — pick your area below.");
      return;
    }
    setLocating(true);
    setLocateMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        let best: { id: string; d: number } | null = null;
        for (const a of areas) {
          if (a.lat == null || a.lng == null) continue;
          const d = distanceKm(latitude, longitude, a.lat, a.lng);
          if (!best || d < best.d) best = { id: a.id, d };
        }
        if (best && best.d <= NEAREST_MAX_KM) {
          choose(best.id, { lat: latitude, lng: longitude });
        } else {
          setLocateMessage("It looks like you're outside our delivery areas. If that's wrong, choose your area below.");
        }
      },
      () => {
        setLocating(false);
        setLocateMessage("We couldn't get your location — pick your area below.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  if (config.deliveryByDistance) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex min-h-[80svh] flex-col sm:min-h-[60svh] sm:max-w-[520px]">
          {open && <PinPicker saved={saved} partners={partners} onDone={() => onOpenChange(false)} />}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex min-h-[80svh] flex-col sm:min-h-[60svh] sm:max-w-[520px]">
        <div className="px-5 pb-3 pt-7 sm:px-8">
          <DialogTitle className="pr-12 text-[1.625rem] sm:text-[1.75rem]">Where should we deliver?</DialogTitle>
          <DialogDescription className="mt-2 text-[14px]">
            Choose your area to see delivery time, fee and minimum order.
          </DialogDescription>

          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="mt-5 flex min-h-12 w-full items-center gap-3 rounded-[12px] border border-black-iron/15 px-4 text-left text-[14px] font-medium transition-colors hover:border-terracotta hover:text-terracotta-ink"
          >
            {locating ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={1.6} />
            ) : (
              <LocateFixed className="h-[18px] w-[18px] text-terracotta-ink" strokeWidth={1.6} />
            )}
            {locating ? "Finding you…" : "Use my current location"}
          </button>
          {locateMessage && (
            <p role="status" className="mt-2 text-[13px] text-rose-sumac">
              {locateMessage}
            </p>
          )}

          <label className="relative mt-3 block">
            <span className="sr-only">Search areas</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-grey" strokeWidth={1.6} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your area — e.g. Marina, JLT"
              autoComplete="off"
              className="h-12 w-full rounded-[12px] border border-black-iron/15 bg-transparent pl-11 pr-4 text-[15px] focus:border-terracotta/60 focus:outline-none focus:ring-1 focus:ring-terracotta/40"
            />
          </label>
        </div>

        <div className="px-3 pb-6 sm:px-5">
          {saved.length > 0 && !q && (
            <div className="mb-2">
              <p className="caption px-3 pb-1 pt-2">Saved addresses</p>
              {saved.map((s) => {
                const area = areas.find((a) => a.id === s.areaId);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => choose(s.areaId, s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-[10px] px-3 text-left hover:bg-black-iron/[0.04]"
                  >
                    <Bookmark className="h-4 w-4 shrink-0 text-terracotta-ink" strokeWidth={1.6} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{s.label}</span>
                      <span className="block truncate text-[12.5px] text-dark-grey">
                        {[s.building, area?.name].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {areas.length === 0 ? (
            <p className="px-3 py-6 text-[14px] text-dark-grey">
              Delivery areas are being set up. Please check back soon.
            </p>
          ) : (
            <>
              {!q && <p className="caption px-3 pb-1 pt-2">All areas</p>}
              <ul>
                {filtered.map((a) => {
                  const zone = zoneById(a.zoneId);
                  const active = a.id === areaId;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => choose(a.id)}
                        aria-current={active || undefined}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3 rounded-[10px] px-3 text-left transition-colors hover:bg-black-iron/[0.04]",
                          active && "bg-terracotta/[0.07]",
                        )}
                      >
                        <MapPin className="h-4 w-4 shrink-0 text-dark-grey" strokeWidth={1.6} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-medium">{a.name}</span>
                          {zone && (
                            <span className="block text-[12.5px] tabular-nums text-dark-grey">
                              {zone.etaMin}–{zone.etaMax} min ·{" "}
                              {zone.feeFils === 0 ? "Free delivery" : `${formatFils(zone.feeFils)} delivery`}
                              {zone.minOrderFils > 0 && ` · Min ${formatFils(zone.minOrderFils)}`}
                            </span>
                          )}
                        </span>
                        {active && <Check className="h-4 w-4 text-terracotta-ink" strokeWidth={2} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {filtered.length === 0 && (
                <div className="rounded-[12px] bg-cream px-4 py-5 text-[14px]">
                  <p className="font-semibold">We don&apos;t deliver to “{query}” yet.</p>
                  <p className="mt-1.5 text-dark-grey">
                    Our kitchen covers a set radius so every dish arrives hot.
                    {partners.length > 0 && " You can still find us on:"}
                  </p>
                  <PartnerLinks partners={partners} />
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PartnerLinks({ partners }: { partners: { label: string; url: string }[] }) {
  if (partners.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {partners.map((p) => (
        <a
          key={p.label}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center rounded-full border border-black-iron/20 px-4 text-[12.5px] font-medium hover:border-terracotta hover:text-terracotta-ink"
        >
          {p.label}
        </a>
      ))}
    </div>
  );
}

type Point = { lat: number; lng: number };

/** Delivery by distance: drag the map until the pin is on your building, then confirm. */
function PinPicker({
  saved,
  partners,
  onDone,
}: {
  saved: SavedAddress[];
  partners: { label: string; url: string }[];
  onDone: () => void;
}) {
  const { lat, lng } = useCart();
  const start = lat != null && lng != null ? { lat, lng } : DUBAI;
  const [focus, setFocus] = React.useState<Point>(start);
  const [pin, setPin] = React.useState<Point>(start);
  const [locating, setLocating] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [outside, setOutside] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const pinned = saved.filter((s) => s.lat != null && s.lng != null);

  function locate() {
    if (!("geolocation" in navigator)) {
      setMessage("Location isn't available on this device — move the map to your building.");
      return;
    }
    setLocating(true);
    setMessage(null);
    const found = (pos: GeolocationPosition) => {
      setLocating(false);
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setFocus(p);
      setPin(p);
    };
    const failed = (err: GeolocationPositionError) => {
      setLocating(false);
      setMessage(
        err.code === err.PERMISSION_DENIED
          ? "Location is turned off for this site — allow it in your browser or phone settings, or move the map to your building."
          : "We couldn't get your location — move the map to your building.",
      );
    };
    // GPS first; indoors or on a laptop it often times out, so fall back to
    // the quicker network-based position (the customer fine-tunes the pin).
    navigator.geolocation.getCurrentPosition(found, (err) => {
      if (err.code === err.PERMISSION_DENIED) return failed(err);
      navigator.geolocation.getCurrentPosition(found, failed, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 });
    }, { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 });
  }

  async function confirm(p: Point) {
    setChecking(true);
    setOutside(null);
    setMessage(null);
    try {
      const res = await fetch("/api/order/locate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 400) setOutside("Sorry — this address is outside our delivery range.");
      else if (!res.ok || !body) setMessage(body?.error ?? "Something went wrong — please try again.");
      else if (!body.ok) setOutside(body.reason);
      else {
        cart.setArea(body.areaId, p, { label: body.place ?? null, street: body.street ?? null });
        onDone();
      }
    } catch {
      setMessage("Something went wrong — please try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <div className="px-5 pb-3 pt-7 sm:px-8">
        <DialogTitle className="pr-12 text-[1.625rem] sm:text-[1.75rem]">Where should we deliver?</DialogTitle>
        <DialogDescription className="mt-2 text-[14px]">
          Move the map until the pin is on your building, then confirm.
        </DialogDescription>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="mt-5 flex min-h-12 w-full items-center gap-3 rounded-[12px] border border-black-iron/15 px-4 text-left text-[14px] font-medium transition-colors hover:border-terracotta hover:text-terracotta-ink"
        >
          {locating ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={1.6} />
          ) : (
            <LocateFixed className="h-[18px] w-[18px] text-terracotta-ink" strokeWidth={1.6} />
          )}
          {locating ? "Finding you…" : "Use my current location"}
        </button>
      </div>

      <div className="mx-5 h-[42svh] min-h-64 overflow-hidden rounded-[12px] border border-black-iron/10 sm:mx-8">
        <LocationMap focus={focus} zoom={lat != null ? 17 : 12} onMove={setPin} />
      </div>

      <div className="px-5 pb-6 pt-4 sm:px-8">
        {message && (
          <p role="status" className="mb-3 text-[13px] text-rose-sumac">
            {message}
          </p>
        )}
        {outside && (
          <div role="status" className="mb-3 rounded-[12px] bg-cream px-4 py-4 text-[14px]">
            <p className="font-semibold">{outside}</p>
            <p className="mt-1.5 text-dark-grey">
              Our kitchen covers a set radius so every dish arrives hot.
              {partners.length > 0 && " You can still find us on:"}
            </p>
            <PartnerLinks partners={partners} />
          </div>
        )}
        <button
          type="button"
          onClick={() => confirm(pin)}
          disabled={checking}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-black-iron px-6 text-[14px] font-semibold text-warm-white transition-colors hover:bg-terracotta-ink disabled:opacity-60"
        >
          {checking && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />}
          Deliver here
        </button>

        {pinned.length > 0 && (
          <div className="mt-4">
            <p className="caption px-1 pb-1">Saved addresses</p>
            {pinned.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => confirm({ lat: s.lat!, lng: s.lng! })}
                className="flex min-h-14 w-full items-center gap-3 rounded-[10px] px-1 text-left hover:bg-black-iron/[0.04]"
              >
                <Bookmark className="h-4 w-4 shrink-0 text-terracotta-ink" strokeWidth={1.6} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{s.label}</span>
                  {s.building && <span className="block truncate text-[12.5px] text-dark-grey">{s.building}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
