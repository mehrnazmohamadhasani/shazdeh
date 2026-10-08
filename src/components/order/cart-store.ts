"use client";
import * as React from "react";

/*
 * Basket state for direct ordering — a tiny external store persisted to
 * localStorage, read with useSyncExternalStore so server HTML (empty
 * basket) and the hydrated client never disagree.
 *
 * Only ids, quantities, option ids and notes are kept. Names and prices
 * are always looked up from the live menu, and the server re-prices
 * everything at checkout.
 */

export type CartLine = {
  key: string;
  itemId: string;
  quantity: number;
  optionIds: string[];
  notes: string;
};

export type SavedAddress = {
  id: string;
  label: string;
  areaId: string;
  addressType: "apartment" | "villa" | "office";
  building: string;
  street: string;
  unit: string;
  floor: string;
  instructions: string;
  lat: number | null;
  lng: number | null;
};

export type CartState = {
  lines: CartLine[];
  areaId: string | null;
  lat: number | null;
  lng: number | null;
};

const KEY = "shazdeh.cart.v1";
const EMPTY: CartState = { lines: [], areaId: null, lat: null, lng: null };

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CartState>;
      state = {
        lines: Array.isArray(parsed.lines) ? parsed.lines.slice(0, 40) : [],
        areaId: typeof parsed.areaId === "string" ? parsed.areaId : null,
        lat: typeof parsed.lat === "number" ? parsed.lat : null,
        lng: typeof parsed.lng === "number" ? parsed.lng : null,
      };
    }
  } catch {
    /* private mode / blocked storage — basket simply isn't remembered */
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function set(next: CartState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      loaded = false;
      load();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

function getServerSnapshot() {
  return EMPTY;
}

export function lineKey(itemId: string, optionIds: string[], notes: string) {
  return [itemId, [...optionIds].sort().join("."), notes.trim().toLowerCase()].join("|");
}

export const cart = {
  add(itemId: string, optionIds: string[], quantity: number, notes = "") {
    const key = lineKey(itemId, optionIds, notes);
    const existing = state.lines.find((l) => l.key === key);
    const lines = existing
      ? state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(30, l.quantity + quantity) } : l))
      : [...state.lines, { key, itemId, optionIds, quantity, notes: notes.trim() }];
    set({ ...state, lines });
  },
  replace(oldKey: string, itemId: string, optionIds: string[], quantity: number, notes = "") {
    const key = lineKey(itemId, optionIds, notes);
    const without = state.lines.filter((l) => l.key !== oldKey);
    const merged = without.find((l) => l.key === key);
    const lines = merged
      ? without.map((l) => (l.key === key ? { ...l, quantity: Math.min(30, l.quantity + quantity) } : l))
      : [...without, { key, itemId, optionIds, quantity, notes: notes.trim() }];
    set({ ...state, lines });
  },
  setQuantity(key: string, quantity: number) {
    const lines =
      quantity <= 0
        ? state.lines.filter((l) => l.key !== key)
        : state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(30, quantity) } : l));
    set({ ...state, lines });
  },
  removeLines(keys: string[]) {
    set({ ...state, lines: state.lines.filter((l) => !keys.includes(l.key)) });
  },
  setArea(areaId: string | null, coords?: { lat: number; lng: number } | null) {
    set({ ...state, areaId, lat: coords?.lat ?? null, lng: coords?.lng ?? null });
  },
  clearLines() {
    set({ ...state, lines: [] });
  },
};

export function useCart(): CartState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ── Small persisted helpers: saved addresses, contact, recent orders ── */

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const savedAddresses = {
  list: () => readJson<SavedAddress[]>("shazdeh.addresses.v1", []).slice(0, 5),
  save(addr: SavedAddress) {
    const rest = savedAddresses.list().filter((a) => a.id !== addr.id);
    writeJson("shazdeh.addresses.v1", [addr, ...rest].slice(0, 5));
  },
  remove(id: string) {
    writeJson("shazdeh.addresses.v1", savedAddresses.list().filter((a) => a.id !== id));
  },
};

export type SavedContact = { name: string; phone: string; email: string };
export const savedContact = {
  get: () => readJson<SavedContact | null>("shazdeh.contact.v1", null),
  set: (c: SavedContact | null) =>
    c ? writeJson("shazdeh.contact.v1", c) : window.localStorage.removeItem("shazdeh.contact.v1"),
};

export type RecentOrder = { number: string; token: string; placedAt: string };
export const recentOrders = {
  list: () => readJson<RecentOrder[]>("shazdeh.orders.v1", []),
  add(o: RecentOrder) {
    writeJson("shazdeh.orders.v1", [o, ...recentOrders.list().filter((x) => x.token !== o.token)].slice(0, 5));
  },
};
