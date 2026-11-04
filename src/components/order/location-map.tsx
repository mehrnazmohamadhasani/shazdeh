"use client";
import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";

/*
 * Drag-the-map location picker: the pin stays in the middle and the
 * map moves under it, which works the same with a finger or a mouse.
 * Loaded client-only (Leaflet touches `window`). Shows nothing about
 * the kitchen — only the customer's own spot.
 */

type Point = { lat: number; lng: number };

/** `zoom`: the starting zoom — wide while we know nothing, close once there is a spot. */
export default function LocationMap({ focus, zoom, onMove }: { focus: Point; zoom: number; onMove: (p: Point) => void }) {
  const el = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<L.Map | null>(null);
  const onMoveRef = React.useRef(onMove);
  React.useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  React.useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center: [focus.lat, focus.lng], zoom });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.on("moveend", () => {
      const c = m.getCenter();
      onMoveRef.current({ lat: c.lat, lng: c.lng });
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // Created once; later focus changes pan the existing map below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = React.useRef(focus);
  React.useEffect(() => {
    const m = map.current;
    if (!m || (focus.lat === start.current.lat && focus.lng === start.current.lng)) return;
    m.setView([focus.lat, focus.lng], Math.max(m.getZoom(), 17));
  }, [focus.lat, focus.lng]);

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full w-full" />
      <MapPin
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-[500] h-9 w-9 -translate-x-1/2 -translate-y-full fill-terracotta text-warm-white drop-shadow"
        strokeWidth={1.4}
      />
    </div>
  );
}
