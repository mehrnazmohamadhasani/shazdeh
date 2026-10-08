# Shazdeh — A Persian Kitchen, Reimagined in Dubai

A premium digital platform for **SHĀZDEH**, a contemporary Persian food
brand in Dubai. SHĀZDEH is **delivery-only** — every primary action on the
public site leads to ordering, now **directly on the website** (`/order`),
with delivery apps and WhatsApp as alternatives. Behind it sits a full
admin atelier (CMS) and a kitchen order board.

```
shazdeh ── public site (cinematic, mobile-first, SEO-ready)
       ├── admin atelier (auth-gated CRUD for everything)
       ├── REST API (validated, type-safe)
       └── image upload pipeline (local / Supabase / Cloudinary)
```

---

## Online ordering

Direct ordering (menu → basket → checkout → tracking), the staff order
board, delivery zones, promo codes, provider-agnostic online payments and
notification hooks. Ordering ships **switched off**; see:

- [`docs/ordering/README.md`](docs/ordering/README.md) — architecture, routes, security, go-live runbook, roadmap
- [`docs/ordering/owner-checklist.md`](docs/ordering/owner-checklist.md) — what to collect from the restaurant
- [`docs/ordering/legal-dubai.md`](docs/ordering/legal-dubai.md) — Dubai/UAE regulatory research

```bash
npm run db:seed:demo   # local only: demo zones, add-ons, promo NOOSH10, ordering on
npm test               # pricing / hours / status / phone unit tests
```

---

## Tech stack

| Layer        | Choice                                            |
| ------------ | ------------------------------------------------- |
| Framework    | **Next.js 16** (App Router · React 19 · Turbopack) |
| Language     | **TypeScript** 5                                  |
| Styling      | **Tailwind CSS v4** (custom Persian-luxury theme) |
| Animation    | **Motion** (Framer Motion)                        |
| Primitives   | **Radix UI** + custom design system                |
| Database     | **Prisma 7** + SQLite (dev) / Postgres (prod)     |
| Auth         | **Custom JWT** (`jose`) over secure HTTP-only cookies |
| Validation   | **Zod**                                           |
| Storage      | local · Supabase Storage · Cloudinary (pluggable) |
| Image opt.   | **Sharp** (resize, mozjpeg)                       |

---

## Quick start

```bash
# 1. Install
npm install

# 2. Set up environment
cp .env.example .env

# 3. Migrate + seed (creates the Shazdeh menu, admin user, banners…)
#    ⚠ Point DATABASE_URL at a local/dev database first — seeding deletes
#    and recreates banners, gallery images and social links.
npm run db:migrate
npm run db:seed

# 4. Run
npm run dev
```

Open `http://localhost:3000` — the public site.
Open `http://localhost:3000/login` — the admin atelier.

Default admin credentials come from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in
`.env` (seed only). **Change the password before deploying** — the example
value is public.

---

## Project structure

```
shazdeh/
├── prisma/
│   ├── schema.prisma            # Data model (Users, Categories, MenuItem,
│   │                            # ItemVariant, Banner, GalleryImage,
│   │                            # SocialLink, RestaurantSettings)
│   ├── seed.ts                  # Full Shazdeh menu seed
│   └── migrations/
├── public/
│   ├── menu/                    # Pre-loaded dish photography
│   ├── brand/                   # Logo, OG, mobile cover
│   └── uploads/                 # Local image upload sink
├── scripts/
│   └── optimize-images.ts       # One-shot Sharp pipeline
└── src/
    ├── proxy.ts                 # /admin auth gate (Next 16 "proxy")
    ├── app/
    │   ├── layout.tsx           # Root: fonts, theme, toaster, metadata
    │   ├── (site)/              # Route group · public website
    │   │   ├── layout.tsx       # SiteNav + SiteFooter + skip link
    │   │   ├── page.tsx         # Home: hero film, signature dishes, story,
    │   │   │                    #   craft, gallery strip, order band
    │   │   ├── menu/page.tsx    # Menu explorer (filters, search, quick view)
    │   │   ├── menu/[slug]/     # Dish pages (SSG + ISR, MenuItem JSON-LD)
    │   │   ├── order/apps/      # Delivery partners, WhatsApp, hours, FAQ
    │   │   ├── legal/[slug]/    # Terms, privacy, refunds, delivery (drafts)
    │   ├── (order)/             # Route group · direct ordering (slim shell)
    │   │   └── order/           # Menu, checkout, track/[token]
    │   │   ├── about/page.tsx   # Brand story, values, hospitality
    │   │   ├── gallery/page.tsx # Editorial masonry + accessible lightbox
    │   │   ├── error.tsx        # Friendly error state
    │   │   └── not-found.tsx
    │   ├── not-found.tsx        # Branded 404 for unmatched URLs
    │   ├── login/page.tsx       # Admin sign-in
    │   ├── admin/               # Auth-gated atelier
    │   │   ├── layout.tsx
    │   │   ├── page.tsx         # Overview + analytics tiles
    │   │   ├── menu-items/      # List + new + [id] editor
    │   │   ├── categories/
    │   │   ├── banners/
    │   │   ├── gallery/
    │   │   ├── social/
    │   │   └── settings/        # Brand, contact, hours, SEO, logo
    │   ├── api/                 # REST API
    │   │   ├── auth/{login,logout}/
    │   │   ├── menu-items/[id]/
    │   │   ├── categories/[id]/
    │   │   ├── banners/[id]/
    │   │   ├── gallery/[id]/
    │   │   ├── social/[id]/
    │   │   ├── settings/
    │   │   └── upload/
    │   ├── sitemap.ts           # Static pages + every dish page
    │   ├── robots.ts
    │   └── opengraph-image.jpg  # Default social card
    ├── components/
    │   ├── ui/                  # Primitives (Button, Input, Dialog, …)
    │   ├── brand/               # Wordmark
    │   ├── icons/               # Custom SVG socials
    │   ├── shared/              # Reveal, PageHero, SectionHeading
    │   ├── home/                # Cinematic home sections
    │   ├── menu/                # DishCard, DishDialog, MenuExplorer
    │   ├── gallery/             # GalleryGrid + Lightbox
    │   ├── site/                # SiteNav, SiteFooter
    │   ├── auth/                # LoginForm
    │   └── admin/               # Sidebar, page header, all CMS forms
    ├── lib/
    │   ├── prisma.ts            # Prisma 7 + better-sqlite3 adapter
    │   ├── auth.ts              # JWT sign/verify, session cookie helpers
    │   ├── api.ts               # Validated route helpers
    │   ├── validators.ts        # Zod schemas for every entity
    │   ├── storage.ts           # local / Supabase / Cloudinary uploaders
    │   ├── menu.ts              # Server data loaders
    │   ├── settings.ts          # RestaurantSettings loader (with fallbacks)
    │   ├── env.ts               # Typed, validated env
    │   └── utils.ts             # cn(), formatPrice(), slugify()
    └── generated/prisma/        # Generated Prisma client
```

---

## Design system

Built to the official brand guidelines (`brand-assets/BrandGuidelines-SHAZDEH.pdf`)
and defined in `src/app/globals.css`.

**Colour** — Terracotta `#ce4927`, Warm White `#fdf6ec`, Black, Dark Grey
`#494e54`, Iron `#dbdee3`, plus the spice palette used sparingly.
`terracotta-ink` (`#b0391b`) is the AA-compliant terracotta for small text;
the brand terracotta is used for fills and large type.

**Type** — Inter (variable) for everything: Bold headlines, Light body.
Persian script is set in Vazirmatn (`lang="fa"`). The logotype fallback is
set in Bodoni Moda until the official SVG is uploaded (Settings → Logo URL).
Fluid scale utilities: `t-display`, `t-h1`, `t-h2`, `t-h3`, `t-lead`,
`t-body`, `eyebrow`, `caption`.

**Layout** — `container-shazdeh` (12-col desktop / 4-col mobile margins),
`section` / `section-sm` for vertical rhythm.

**Motif** — the Persian arch from the brand's social templates: `arch`
(image frame) and `<ArchLines />` (hairline drawing). Used with restraint.

**Components** — `Button` (primary · outline · light · outline-light …),
`Badge`, `Dialog` (bottom sheet on phones), `SectionHeading`, `TextLink`,
`PageHero`, `Reveal`, `DishCard` (card · row · feature).

**Motion** — one easing curve (`lib/motion.ts`), short reveals, CSS-driven
hero entrances (no LCP delay). `MotionConfig reducedMotion="user"` plus a
CSS reduced-motion guard; the hero video has a pause control.

---

## Database & data model

Prisma schema covers every entity the brand needs:

- `User` + `Session` — admin auth
- `Category` — menu sections (Mains, Vegetarian, Sides, Drinks…)
- `MenuItem` — dishes (English + Persian name, price, image, story,
   spicy level, vegetarian, signature, bestseller, new flags)
- `ItemVariant` — per-item options (e.g. small / large)
- `Banner` — homepage and section heroes (`home_hero`, `home_secondary`,
   `menu_hero`)
- `GalleryImage` — editorial photo set
- `SocialLink` — Instagram, WhatsApp, Talabat, Deliveroo, Careem, Noon…
- `RestaurantSettings` — single-row store for brand, contact, hours,
   SEO meta, logo, OG image

The seed script (`prisma/seed.ts`) ships the **full Shazdeh menu**:
12 mains, 5 vegetarian, 7 sides, 7 drinks — with the prices you supplied.

---

## API

All routes live under `/api/*` and respond JSON. Mutating routes
(`POST` / `PATCH` / `DELETE`) require a valid admin session cookie.

| Method | Path                         | Notes                          |
| ------ | ---------------------------- | ------------------------------ |
| POST   | `/api/auth/login`            | `{ email, password }`          |
| POST   | `/api/auth/logout`           |                                |
| GET    | `/api/menu-items`            | public                         |
| POST   | `/api/menu-items`            | admin                          |
| GET    | `/api/menu-items/[id]`       | public                         |
| PATCH  | `/api/menu-items/[id]`       | admin                          |
| DELETE | `/api/menu-items/[id]`       | admin                          |
| GET    | `/api/categories`            | public                         |
| POST   | `/api/categories`            | admin                          |
| PATCH  | `/api/categories/[id]`       | admin                          |
| DELETE | `/api/categories/[id]`       | admin                          |
| `…`    | banners, gallery, social     | identical CRUD pattern         |
| GET    | `/api/settings`              | public                         |
| PATCH  | `/api/settings`              | admin                          |
| POST   | `/api/upload`                | admin · multipart `file`       |

Validation is enforced with Zod; bad payloads get `422` with a readable
first-issue message. Links are restricted to http(s)/mailto/tel/relative
paths. Unique-constraint and not-found DB errors map to `409` / `404`; other
server errors return a generic message (details are logged, never sent).
Every successful mutation revalidates the public site immediately.
Sign-in is rate-limited (per instance) and timing-safe.

---

## Image uploads

The `uploadImage()` helper in `src/lib/storage.ts` runs every upload
through Sharp (auto-rotate, max-width 2400, mozjpeg @ Q84) and dispatches
to one of three backends based on `STORAGE_DRIVER`:

| Driver       | Stored at                                      |
| ------------ | ---------------------------------------------- |
| `local`      | `public/uploads/<folder>/<file>` (default)     |
| `supabase`   | `https://xxx.supabase.co/storage/v1/...`       |
| `cloudinary` | `https://res.cloudinary.com/<cloud>/image/...` |

Add new backends by extending the switch in `storage.ts`.

---

## Responsive strategy

Designed per breakpoint rather than shrunk: phones get a two-up dish grid,
a snap carousel of arch-framed signature dishes, a slim sticky category
rail (search and filters stay in the flow), bottom-sheet dish details and
a full-screen accessible menu. 44px minimum touch targets throughout.

---

## Production deployment

### Recommended target — **Vercel + Supabase Postgres + Supabase Storage**

1. **Database**: spin up a Postgres on Supabase (or Neon, Railway,
   Planetscale). Update `prisma/schema.prisma` `provider = "postgresql"`,
   then run `npx prisma migrate deploy` against your prod DATABASE_URL.
2. **Storage**: create a public Supabase bucket (e.g. `shazdeh-uploads`).
   Set `STORAGE_DRIVER=supabase` and the supabase env vars.
3. **Env vars** (Vercel → Project Settings → Environment):
   ```
   DATABASE_URL=postgres://…
   AUTH_SECRET=<openssl rand -base64 48>
   NEXT_PUBLIC_SITE_URL=https://shazdeh.ae
   STORAGE_DRIVER=supabase
   SUPABASE_URL=…
   SUPABASE_SERVICE_KEY=…
   SUPABASE_BUCKET=shazdeh-uploads
   ADMIN_EMAIL=admin@shazdeh.ae
   ADMIN_PASSWORD=<secure>
   ```
4. **First deploy**: after deploy, run the seed once via
   `vercel exec npm run db:seed` (or temporarily expose a one-off route).
5. **CDN images**: `next.config.ts` already whitelists Supabase &
   Cloudinary domains for `<Image />` optimization.

### Self-hosting (Docker, Coolify, Railway, etc.)

Standard Next.js production build:

```bash
npm run build
npm run start
```

The bundle is fully self-contained except for the Prisma client — make
sure the host has access to `node_modules/.prisma` and the
`@prisma/adapter-better-sqlite3` native binding (or swap in
`@prisma/adapter-pg` for Postgres).

---

## Scripts

| Command                  | What it does                              |
| ------------------------ | ----------------------------------------- |
| `npm run dev`            | Local dev server                          |
| `npm run build`          | `prisma generate` + **`prisma db push`** + `next build` — note the push runs against whatever `DATABASE_URL` points at |
| `npm run start`          | Run production build                      |
| `npm run lint`           | ESLint                                    |
| `npm run db:migrate`     | Create + apply a new dev migration        |
| `npm run db:reset`       | Drop, re-migrate, re-seed                 |
| `npm run db:seed`        | Re-seed the Shazdeh menu                  |
| `npm run db:studio`      | Prisma Studio (visual DB editor)          |
| `npm run images:optimize`| Re-optimize the brand asset pack          |

---

## License

Proprietary — © Shazdeh, Dubai. All rights reserved.
