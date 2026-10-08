# SHĀZDEH direct ordering — architecture & runbook

Customers order from SHĀZDEH's own website (`/order`) with no marketplace in between. Staff run orders from the admin (`/admin/orders`). This document covers how it fits together and what is needed to go live.

Related: [legal-dubai.md](./legal-dubai.md) (regulatory research) · [owner-checklist.md](./owner-checklist.md) (what to request from the restaurant).

---

## 1. Customer journey

```
Site "Order now" ─▶ /order ─▶ choose area (first visit) ─▶ browse ─▶ dish sheet (size, options, notes, qty)
   ─▶ basket (sticky sidebar / "View basket" bar) ─▶ /order/checkout (address · details · payment · promo)
   ─▶ place order ─┬─ pay on delivery ──────────────▶ /order/track/<token>  (confirmation + live status)
                   └─ pay online ─▶ gateway page ─▶ /api/payments/<p>/return ─▶ /order/track/<token>
```

* **Guest checkout only.** Name, UAE mobile, optional email. Details and up to five addresses can be remembered **on the customer's own device** (localStorage) — no accounts, no passwords.
* **Area first.** Dubai addresses are communities, so customers pick their area (search, or "use my location" → nearest area). The area decides fee, minimum and delivery window. Outside coverage → friendly message + delivery-app links; checkout is blocked.
* **Tracking** shows only what the backend knows: status changes made by staff, rider first name if entered, a courier's own tracking link if pasted at dispatch. No fake GPS.

## 2. Routes

| Route | Who | Purpose |
| --- | --- | --- |
| `/order` | public | Ordering menu (ISR, 30 s; admin changes revalidate instantly) |
| `/order/checkout` | public, noindex | Checkout |
| `/order/track/[token]` | holder of link, noindex | Confirmation + live status |
| `/order/pay/mock/[token]` | dev only | Stand-in gateway when `PAYMENT_PROVIDER=mock` |
| `/order/apps` | public | Previous "Order" page: delivery apps, WhatsApp, hours, FAQ |
| `/legal/{terms,privacy,refunds,delivery}` | public | Policy **drafts** |
| `/admin/orders`, `/admin/orders/[id]` | Admin, Editor, Staff | Kitchen board, order detail |
| `/admin/delivery` | Admin, Editor (edit: Admin) | Zones & areas |
| `/admin/coupons` | Admin, Editor (edit: Admin) | Promo codes |
| `/admin/ordering` | Admin | Ordering settings |
| `/admin/team` | Admin | Users & roles |
| `/admin/menu-items/[id]` | Admin, Editor | + "Shown on menu", "In stock", options & add-ons |

API: `POST /api/order/quote`, `POST /api/orders`, `GET /api/orders/track/[token]`, `POST /api/orders/[token]/abandon`, `POST /api/payments/[provider]/webhook`, `GET /api/payments/[provider]/return`, `GET|PATCH /api/admin/orders[/id]`, `PATCH /api/admin/ordering[/accepting]`, `/api/admin/zones[/id]`, `/api/admin/coupons[/id]`, `/api/admin/team[/id]`, `GET|PUT /api/menu-items/[id]/modifiers`.

## 3. Data model (additive migration `20261007120000_online_ordering`)

* `MenuItem.isActive` (shown/hidden) — `isAvailable` keeps meaning "in stock".
* `ModifierGroup` / `ModifierOption` — per-dish questions with min/max and price deltas.
* `OrderingSettings` (single row) — accepting orders (busy switch), delivery hours, kitchen coordinates, VAT rate & inclusivity, service fee, enabled payment methods, delivery model, auto-accept, cutlery default, kitchen email, legal name / licence / authority / TRN.
* `DeliveryZone` (fee, minimum, free-over, ETA window, optional radius) → `DeliveryArea` (unique community name, optional lat/lng).
* `Coupon` (percent / fixed / free delivery, min subtotal, cap, dates, total & per-phone limits, atomic `usedCount`).
* `Customer` (by phone), `Order` (address + money snapshot, integer **fils**), `OrderItem` (name, portion, options snapshot), `OrderEvent` (audit trail), `Payment`, `WebhookEvent` (idempotency), `Notification` (outbox log).
* `UserRole.STAFF`.

Portions stored as separate dishes ("Sabzi Khordan — Small/Large") are shown as **one product with a size choice** in ordering; nothing in the CMS changes.

## 4. Money & pricing

`src/lib/ordering/pricing.ts` is pure and runs in both the browser (instant basket) and server (authoritative). The client only ever sends item ids, option ids, quantities and notes. The server reloads prices, checks availability and option rules, resolves the zone, validates the promo, computes delivery/service/discount/VAT, and **refuses the order if the total differs from what the customer saw** (409 → updated total shown). Prices are VAT-inclusive by default (UAE consumer rule); VAT is back-calculated and shown.

## 5. Order lifecycle

`PENDING_PAYMENT → RECEIVED → CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED`, plus `REJECTED` (only while new) and `CANCELLED` (any time before delivery). Rules live in `src/lib/ordering/status.ts`; updates use optimistic locking so two tablets can't double-apply. Reject/cancel require a customer-visible reason; promo use is returned. Cancelling a paid online order logs a "refund from gateway dashboard" note.

**Auto-accept** (Online ordering → "Accept orders automatically") skips `RECEIVED`: the order lands in `CONFIRMED` and the customer is told it's confirmed. It still rings (see below) until someone taps **Got it**.

**Sold out mid-order.** On the order page each dish has **Sold out…** (until the order is ready): choose how many can still be made, the rest comes off the order, the total is recalculated (fees kept; a percentage promo shrinks with the basket; a fixed promo never exceeds what's left — `repriceAfterRemoval`), the customer gets an "Your order has changed" email/push with the new total, and — by default — the dish is marked sold out on the menu so nobody else orders it (kitchen staff can do this without menu access). Paid online → a "refund the difference" note is logged. If it was the only dish, reject/cancel instead.

### Admin alarm

`src/components/admin/orders/order-alarm.tsx` is mounted in the admin layout, so it runs on **every admin page** and has **no off switch**. It rings while any active order has no `seenAt` — accepting, rejecting or any other status change sets it; auto-accepted orders need **Got it**. Browsers mute audio until the first tap after a full page load, so a full-screen "Tap to switch on the order alarm" prompt covers the admin until tapped (that tap also enables system notifications and staff push). The screen is kept awake, the tab title shows the waiting count, and a red banner shows on every admin page.

### Printing tickets

Each order prints two 80 mm tickets (`/api/admin/orders/<id>/tickets`, `?copy=kitchen|delivery`): **Kitchen** (number, deliver-by time, customer name + phone, dishes with options/notes, cutlery, order note) and **Delivery** (name, phone, full address + instructions, a boxed "COLLECT CASH / CARD MACHINE / PAID", itemised receipt with VAT and TRN). Print by hand from the board card or order page.

**Automatic:** on the device next to the printer, switch on **Print tickets automatically on this device** on the Orders board. Every order is printed once as soon as it's accepted (immediately with auto-accept); the server hands each order to one device only (`printedAt`), so two tablets never double-print. Browsers show a print dialog for every page — for truly silent printing, start Chrome/Edge on that device with the receipt printer as the system default and:

```
chrome --kiosk-printing https://<your-domain>/admin/orders
```

## 6. Payments (`src/lib/payments/`)

`OnlinePaymentProvider` interface: `createCheckout`, `fetchStatus`, `parseWebhook` (signature-verified), optional `cancel`. Hosted pages only, so card data never touches this server (PCI DSS SAQ A). Included: **Stripe Checkout** reference adapter (REST, no SDK) and a **mock** gateway for development. Add Telr / N-Genius / Checkout.com by implementing the interface and registering it in `index.ts`. Online payment appears at checkout only when a provider is configured **and** the admin enables it. Unpaid online orders stay hidden from the kitchen; webhooks are processed once (`WebhookEvent`), and the return URL checks status server-to-server.

Cash on delivery and card on delivery work without any provider — the launch path.

## 7. Delivery (`src/lib/delivery/`)

`DeliveryProvider.dispatch()` is called when staff tap **Dispatch**. `own_fleet` records rider name/phone; `courier` records a 3PL booking ref + tracking link. `OrderingSettings.deliveryModel` (own / third-party / hybrid) decides which appear. A courier with an API becomes a third provider that books the job itself — checkout and the board don't change.

## 8. Notifications (`src/lib/notifications/`)

Every attempt is logged to `Notification`. Channels switch on by env: **email** via Resend (customer receipts/status with an HTML order summary — including "Order confirmed" when accepted; kitchen inbox for new/paid/cancelled), **Web Push** (`VAPID_*`; customers tap "Notify me about every step" on the tracking page and get received → confirmed → preparing → ready → on its way → delivered, plus changes/cancellation; staff devices get new orders even with the admin closed; iPhone needs the site added to the Home Screen) and a signed **webhook** (`ORDER_WEBHOOK_URL`) to fan out to Slack / Make / Zapier / a WhatsApp Business or SMS provider. Sent after the response (`next/server` `after`). The kitchen never depends on them: the board polls every 8 s, chimes, and shows the waiting count in the tab title.

## 9. Security measures

* Server-side pricing, totals, fees, VAT, discounts; idempotency keys; price-change refusal.
* Zod validation on every input; UAE mobile normalisation; https-only tracking links.
* Atomic coupon redemption (`usedCount < usageLimit` in the order transaction); per-phone limits.
* Rate limits: quote 90/min/IP, orders 10/10 min/IP and 6/10 min/phone, tracking 120/min/IP (in-memory per instance — use Redis/Upstash or edge limits at scale).
* Unguessable 24-char tracking tokens; tracking pages `noindex`, `no-referrer`, phone masked.
* Roles: `STAFF` can only reach `/admin/orders` (proxy + layout + API). Admin APIs and pages re-read the user from the DB, so removing a user or changing a role is immediate.
* Webhook signature verification with timestamp tolerance; replay-safe.
* Geolocation allowed for same-origin only (`Permissions-Policy`).

## 10. Mobile & performance

Mobile-first: area sheet on first visit, sticky category rail with scroll-spy, thumb-zone "View basket · total" bar, bottom-sheet dish view with the add button pinned, 44 px+ targets, stepper turns into remove at 1, numeric/tel keyboards, autocomplete, side-by-side apartment/floor fields, one-page checkout with a pinned "Place order" bar. ISR menu (no client data fetch on load), `next/image` with explicit `sizes`, two lazy images preloaded, no animation libraries in the ordering flow, debounced quotes, localStorage basket via `useSyncExternalStore` (no hydration flicker).

## 11. Going live — runbook

1. **Database**: run `npx prisma db push` against the production `DATABASE_URL` (the build no longer touches the schema). Ordering is **off** by default.
2. Admin → **Ordering settings**: legal name, licence, authority, TRN; delivery hours; payment methods; kitchen email; delivery model.
3. Admin → **Delivery zones**: real zones, fees, minimums, ETAs (≤ 30 min transit per DM guideline unless temperature-controlled), areas (+ coordinates for "use my location").
4. Admin → **Menu items**: allergens + ingredients for every dish; options & add-ons; hide anything not sold online.
5. Admin → **Team**: create `Staff` logins for kitchen tablets; change the seeded admin password.
6. Legal: lawyer reviews `/legal/*` (and Arabic versions) → set `LEGAL_REVIEWED=true`.
7. Optional now / later: `RESEND_API_KEY` + `EMAIL_FROM` (customer emails — email is optional at checkout, so only customers who give one get them), `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (push; generate with `npx web-push generate-vapid-keys`), `ORDER_WEBHOOK_URL`; payment provider keys + webhook endpoint.
8. Place a real test order end-to-end on the production domain, then switch **Accept online orders** on.

`npm run db:seed:demo` seeds illustrative zones, add-ons and the `NOOSH10` code — **local only**, never production. `npm test` runs the pricing/hours/status/phone tests.

## 12. Roadmap

**MVP (built):** ordering menu with sizes/options, basket, area-based zones, guest checkout, cash/card on delivery, promo codes, VAT-inclusive totals, confirmation + tracking, kitchen board with an always-on admin-wide alarm and busy switch, order detail with sold-out handling, kitchen + delivery tickets (manual or auto-print), customer web push, menu/zone/coupon/settings/team admin, provider-agnostic online payments (Stripe + mock), notification hooks, policy drafts.

**Phase 2:** go live with a UAE gateway (adapter for the chosen provider, refunds via API), SMS/WhatsApp OTP to verify phones (unlocks safe first-order offers and order history), WhatsApp Business notifications, Arabic UI, scheduled orders, a cron to expire stale `PENDING_PAYMENT` orders for gateways without expiry webhooks, Redis rate limiting, printable simplified tax invoice (PDF/email), sales reports & CSV export, shared option sets across dishes, real-time board via SSE.

**Phase 3:** customer accounts & loyalty, reorder, polygon zones on a map, 3PL API dispatch (e.g. Careem Box / local couriers), live rider location if the fleet app provides it, ratings, upsell/cross-sell, multiple kitchens/branches.
