# Shazdeh — A Persian Kitchen, Reimagined in Dubai

A premium, production-ready digital menu platform for **Shazdeh**, a modern
Iranian-inspired kitchen brand based in Dubai. This is not a restaurant
template — it is a luxury lifestyle digital food platform with a
cinematic public site and a full admin atelier (CMS) behind it.

```
shazdeh ── public site (cinematic, mobile-first, SEO-ready)
       ├── admin atelier (auth-gated CRUD for everything)
       ├── REST API (validated, type-safe)
       └── image upload pipeline (local / Supabase / Cloudinary)
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
npm run db:migrate
npm run db:seed

# 4. Run
npm run dev
```

Open `http://localhost:3000` — the public site.
Open `http://localhost:3000/login` — the admin atelier.

Default admin credentials (from `.env`):

```
admin@shazdeh.ae / shazdeh-admin
```

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
    ├── middleware.ts            # /admin auth gate
    ├── app/
    │   ├── layout.tsx           # Root: fonts, theme, toaster, metadata
    │   ├── (site)/              # Route group · public website
    │   │   ├── layout.tsx       # SiteNav + SiteFooter
    │   │   ├── page.tsx         # Cinematic home
    │   │   ├── menu/page.tsx    # Dynamic menu w/ filters & item dialog
    │   │   ├── about/page.tsx   # Editorial brand story
    │   │   ├── gallery/page.tsx # Editorial masonry + lightbox
    │   │   ├── contact/page.tsx # WhatsApp / Instagram / delivery / map
    │   │   └── not-found.tsx
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
    │   ├── sitemap.ts
    │   └── robots.ts
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

A bespoke **Persian-luxury** palette defined in `src/app/globals.css`:

| Token        | Value                                         | Use                |
| ------------ | --------------------------------------------- | ------------------ |
| `--color-onyx`        | warm near-black                       | base background    |
| `--color-ink`         | deep ink                              | sections / cards   |
| `--color-bone`        | warm bone                             | primary text       |
| `--color-cream`       | soft cream                            | accents            |
| `--color-saffron`     | Iranian saffron gold                  | brand accent       |
| `--color-brass`       | deep brass                            | gradients          |
| `--color-pomegranate` | deep pomegranate red                  | destructive        |
| `--color-pistachio`   | pistachio green                       | vegetarian tag     |

Type stack:

| Family           | Use                              |
| ---------------- | -------------------------------- |
| Cormorant Garamond (serif) | display, editorial headings |
| Inter (sans)     | UI, body, eyebrows               |
| Allura (script)  | brand flourishes                 |

Motion — easing `cubic-bezier(0.22, 1, 0.36, 1)` for a slow, cinematic feel.
Reveal-on-scroll, parallax, and shared-layout transitions throughout.

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

Validation is enforced with Zod; bad payloads get `422` with details.

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

## Animation strategy

- **Cinematic, never busy.** Slow easing curves, long durations, generous
  whitespace.
- **Hero parallax** with `useScroll` + `useTransform` for foreground /
  background drift.
- **Stagger reveal** for grids of dishes / pillars / values via the
  `<Reveal>` and `<RevealStagger>` helpers.
- **Layout transitions** for nav underline (`layoutId="nav-underline"`).
- **Lightbox** with keyboard nav (arrows, esc).
- **Marquee** style horizontal scroll for the home gallery preview.
- All animations respect `prefers-reduced-motion` (browser default).

---

## Responsive strategy

Mobile-first — every section starts at full-bleed mobile and grows into
multi-column desktop layouts. Sticky filter bar on the menu, full-screen
mobile nav drawer, and collapsible admin sidebar for ≥ lg breakpoints.

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
| `npm run build`          | Production build (also runs `prisma generate`) |
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
