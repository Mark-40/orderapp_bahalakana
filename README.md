# Snack & Breakfast Ordering App

A mobile-first ordering web app for a small snack and breakfast business. Customers
browse the menu and place an order without an account; the owner manages the menu,
prices, availability and orders from a phone.

Prices are in Philippine Pesos (₱).

---

## 1. What was built

### Customer side

- **Menu** — every active category rendered as a section on one scrollable page, with
  a sticky category strip that both jumps to a section and tracks which one is on screen.
- **Menu cards** — photo, name, description, price, availability. Unavailable items stay
  visible but are muted, greyed and cannot be added.
- **Cart** — a bottom sheet on phones, a side panel from `sm` up. Quantity steppers,
  per-line remove, running total, and a sticky bar showing item count and subtotal.
  Persists in `localStorage` across navigation and reloads.
- **Freshness check** — opening the cart re-reads prices and availability from the
  server, so changes surface before the customer fills in the checkout form.
- **Checkout** — name, mobile, optional email, notes, and pickup/delivery with an
  address field that appears only for delivery. Validated on the client for speed and
  again on the server for truth.
- **Confirmation** — order number, status badge, itemised totals, contact details.
  Addressable by order number, so the customer can reopen it to check status.

### Admin side

- **Login** at `/admin/login`, session cookie, all `/admin/*` routes protected.
- **Dashboard** — orders, sales, pending, completed; average order value, items sold,
  busiest day, best sellers, and recent orders. Date range: today / yesterday /
  last 7 / last 30 / custom.
- **Orders** — search (order number, name, phone), status filter, date range,
  pagination. Card list on phones, table from `md` up.
- **Order detail** — customer block, frozen line items, totals, one-tap "advance to
  next status" plus a full status dropdown.
- **Menu** — full CRUD, inline price editing, one-tap availability toggle, image
  upload or URL paste, search and category filter.
- **Categories** — create, edit, delete (blocked while items remain), reorder, hide.
- **Settings** — account info, shop configuration, change password.

### Verified

`npm run smoke` runs 37 end-to-end checks against a live server and real database —
route protection, forged-cookie rejection, server-side pricing, tampered-payload
rejection, idempotency, quantity validation, historical price preservation, deletion
safety, and dashboard arithmetic. All pass. The full customer and admin flows were
also driven manually in a browser.

---

## 2. Technology stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Language | TypeScript 5.9, `strict` + `noUncheckedIndexedAccess` |
| UI | React 19, Tailwind CSS v4, Radix UI primitives, CVA, lucide-react, sonner |
| Database | PostgreSQL 17 |
| ORM | Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| Validation | Zod 4 |
| Auth | `jose` (HS256 JWT in an HttpOnly cookie) + `bcryptjs` |

### A note on authentication

The brief suggested NextAuth/Auth.js. Auth.js v5 — the version that works with the App
Router — is still a beta release, so rather than take that on for a single
email/password login, this uses a small, stable equivalent: bcrypt hashing (cost 12),
an HS256-signed JWT in an `HttpOnly` / `SameSite=Lax` / `Secure` cookie, verified
server-side on every admin page and every mutating action. Roughly 120 lines in
`src/lib/auth/`, no beta dependency. Swapping in Auth.js later means replacing
`startSession`/`getSession` — the guards and pages call those, not the library.

### A note on money

Every monetary value is an **integer number of centavos** (`₱1` = `100`). Integer
arithmetic keeps totals exact and serialises cleanly across the server/client boundary,
which Prisma's `Decimal` does not. Conversion happens only at the UI edge, in
`src/lib/money.ts`.

---

## 3. Database schema

```
User          id, name, email (unique), passwordHash, role, isActive,
              lastLoginAt, createdAt, updatedAt

Category      id, name (unique), slug (unique), description, sortOrder,
              isActive, createdAt, updatedAt

MenuItem      id, categoryId → Category, name, description, price*,
              imageUrl, isAvailable, sortOrder, createdAt, updatedAt
              unique (categoryId, name)

Order         id, orderNumber (unique), idempotencyKey (unique),
              customerName, customerPhone, customerEmail, notes,
              fulfillment, deliveryAddress, status, subtotal*, total*,
              itemCount, cancelledAt, completedAt, createdAt, updatedAt

OrderItem     id, orderId → Order (cascade), menuItemId → MenuItem (set null),
              productName, price*, quantity, subtotal*

OrderCounter  day (PK, YYYYMMDD), last          -- atomic per-day sequence

* integer centavos
```

Enums: `Role` (ADMIN, STAFF), `OrderStatus` (PENDING, CONFIRMED, PREPARING, READY,
COMPLETED, CANCELLED), `FulfillmentType` (PICKUP, DELIVERY).

**Historical accuracy.** `OrderItem` stores `productName` and `price` as a snapshot
taken at order time. Deleting a menu item sets `OrderItem.menuItemId` to `NULL`
(never cascades), so past orders keep the exact name and price they were placed with.
Re-pricing an item likewise cannot alter any order already in the system.

---

## 4. Routes

### Customer

| Route | Purpose |
| --- | --- |
| `/` | Menu — categories, items, cart |
| `/checkout` | Customer details and order submission |
| `/order/[orderNumber]` | Order confirmation and live status |

### Admin (all require a valid session)

| Route | Purpose |
| --- | --- |
| `/admin/login` | Sign in |
| `/admin` | Dashboard |
| `/admin/orders` | Order list — search, filters, pagination |
| `/admin/orders/[id]` | Order detail and status update |
| `/admin/menu` | Menu CRUD, price and availability |
| `/admin/categories` | Category CRUD and ordering |
| `/admin/settings` | Account, shop info, change password |

### API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Liveness probe; checks the database is reachable |

Everything else is a Server Action — there is no public write API surface beyond
order submission.

---

## 5. Environment variables

Copy `.env.example` to `.env` and fill it in.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | ≥ 32 chars; signs the session cookie |
| `SESSION_MAX_AGE_SECONDS` | no | Session lifetime, default 28800 (8h) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | seed only | Used by `db:seed` |
| `NEXT_PUBLIC_BUSINESS_NAME` | no | Shown in the customer header |
| `STORAGE_DRIVER` | no | `local` (default) \| `cloudinary` \| `s3` |
| `LOCAL_UPLOAD_DIR` / `LOCAL_PUBLIC_PREFIX` | no | Local driver paths |
| `CLOUDINARY_*` | if cloudinary | Cloud name, API key, API secret, folder |
| `S3_*` | if s3 | Bucket, region, endpoint, keys, public base URL |
| `ORDER_RATE_LIMIT_MAX` / `ORDER_RATE_LIMIT_WINDOW_SECONDS` | no | Defaults: 8 per 10 min |
| `DB_PORT` | no | Host port for the Docker database, default 5434 |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Only `NEXT_PUBLIC_*` variables reach the browser. Nothing else is exposed to the client.

---

## 6. Running locally

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then set AUTH_SECRET

npm run db:up               # start PostgreSQL in Docker
npm run db:migrate          # apply migrations
npm run db:seed             # categories, menu, admin, sample orders

npm run dev                 # http://localhost:3000
```

Customer menu: <http://localhost:3000> · Admin: <http://localhost:3000/admin>

> The bundled `docker-compose.yml` publishes Postgres on host port **5434**, because
> 5432 was already taken on the machine this was built on. Override with `DB_PORT`
> and update `DATABASE_URL` to match. To use an existing PostgreSQL instead, just
> point `DATABASE_URL` at it and skip `db:up`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve (no migrations — see below) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run smoke` | 37 end-to-end checks (server must be running) |
| `npm run db:up` / `db:down` | Start / stop the Docker database |
| `npm run db:migrate` | Create and apply a migration (dev) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Seed data |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Prisma Studio |

### Migrations

```bash
npm run db:migrate            # dev: creates + applies, regenerates the client
npm run db:deploy             # production: applies existing migrations only
```

Prisma 7 keeps the connection URL out of `schema.prisma`; the CLI reads it from
`prisma.config.ts` and the runtime client gets it through the pg driver adapter in
`src/lib/db.ts`.

**Migrations are deliberate, not part of `npm run build`.** Apply them yourself
before deploying code that depends on them:

```bash
npm run db:deploy   # then push / deploy
```

Running `prisma migrate deploy` inside the build looks convenient but breaks on
serverless hosts. Prisma's schema engine needs a real session (it takes an
advisory lock), so it cannot go through a transaction-mode pooler at all, and
through Supabase's session-mode pooler it competes for the same 15 client slots
as live traffic — a busy app makes the build fail with
`FATAL: (EMAXCONNSESSION) max clients reached in session mode`. Every preview
deploy would also migrate the production database, and one failed migration
blocks an unrelated deploy.

### Connection pooling

`DATABASE_URL` should point at Supabase's **transaction**-mode pooler
(port `6543`) in production. Session mode (port `5432`) holds one server
connection per client for its entire lifetime, which serverless instances
exhaust quickly; transaction mode hands the connection back after each
statement. `src/lib/db.ts` also caps the per-instance pool — 1 connection on
Vercel, 5 elsewhere, override with `DATABASE_POOL_MAX`.

The Prisma CLI is the exception: `db:migrate` / `db:deploy` need session mode
(`5432`) or a direct connection, which is another reason to run them from a
machine rather than from the build.

### Seeding

```bash
npm run db:seed
```

Creates 4 categories, 13 menu items (one unavailable, one without a photo), the admin
user, and 12 sample orders spread across three days with a mix of statuses. Categories,
items and the admin are **upserted**, so re-running is safe. Sample orders are skipped
whenever orders already exist, so re-seeding never inflates the dashboard.

---

## 7. Default admin

Seeded from the environment, defaulting to:

```
Email     admin@snackshop.test
Password  Admin123!change
```

**Change this before deploying.** Either set `ADMIN_EMAIL` / `ADMIN_PASSWORD` before
seeding, or sign in and use Settings → Change password. There is no public sign-up:
additional staff are created by seeding or directly in the database.

---

## 8. Security

- Passwords hashed with bcrypt at cost 12; login failures are indistinguishable in both
  message and timing, so the form cannot be used to enumerate accounts.
- Session JWT is HS256-signed and stored `HttpOnly` + `SameSite=Lax` + `Secure` in
  production — unreadable from JavaScript.
- `proxy.ts` gives a fast redirect for admin navigations, but it is **not** the
  authorization boundary: it only checks that a cookie is present. Every admin page
  calls `requireAdmin()` and every mutating action calls `requireAdminAction()`, which
  verify the signature server-side.
- `SameSite=Lax` plus Next.js's built-in Server Action origin checking covers CSRF.
- All input validated with Zod on the server, whatever the client did.
- Prisma parameterises every query.
- Order submission is rate-limited per IP.
- The login `next` parameter accepts same-origin relative paths only — no open redirect.
- Order confirmation pages are `noindex`: they carry a customer's name and phone.
- **The server never trusts the client for money.** The checkout payload contains item
  ids and quantities only; names, prices and every total are re-read from the database
  and recomputed before anything is written.

---

## 9. Business rules

1. Only available items, in active categories, can be ordered — enforced in the UI and
   re-checked on the server at submission.
2. Totals are computed server-side from live database prices.
3. Menu price changes never affect existing orders.
4. Deleting a menu item never deletes order history.
5. Order totals are frozen at creation.
6. Admin routes require authentication.
7. Customers need no account.
8. Mobile-first throughout.
9. Order numbers (`ORD-YYYYMMDD-NNN`) are unique, via an atomic per-day counter inside
   the order transaction plus a unique index.
10. Duplicate submission is prevented by a per-attempt idempotency key — a replay
    returns the original order rather than creating a second one.
11. Availability is re-validated at submission, not just when the cart opens.
12. Negative quantities are rejected.
13. Quantities must be integers ≥ 1 (and ≤ 99 per line).

---

## 10. Image storage

Application code depends only on the `StorageProvider` interface
(`src/lib/storage/types.ts`). Three drivers ship:

| Driver | Notes |
| --- | --- |
| `local` | Writes to `public/uploads`. Good for dev and single-box deploys. |
| `cloudinary` | Signed REST upload, no SDK dependency. |
| `s3` | S3 / DigitalOcean Spaces / R2 / MinIO via hand-rolled SigV4, no AWS SDK. |

Switching is a `STORAGE_DRIVER` change, not a code change. Adding another provider
means writing one more implementation of that interface.

Images render through `<SmartImage>`, a plain `<img>` with a warm emoji placeholder for
missing or broken sources. That keeps Next.js's `images.remotePatterns` out of the
picture, so the build config is not coupled to whichever host is in use. The admin form
also accepts a pasted image URL, so the shop can use images they already host without
configuring any provider.

---

## 11. Project structure

```
prisma/            schema, migrations, seed
scripts/           smoke.ts — end-to-end verification
src/
  app/
    (shop)/        customer routes, wrapped in CartProvider
      (menu)/      menu page + its loading skeleton
      checkout/
      order/[orderNumber]/
    admin/
      login/
      (dashboard)/ authenticated shell + all admin pages
    api/health/
  components/
    ui/            button, field, card, badge, sheet, dialog,
                   confirm-dialog, states, smart-image
    customer/      MenuCard, CategoryTabs, MenuBrowser, CartDrawer,
                   CartItem, OrderSummary, CheckoutForm, SiteHeader
    admin/         AdminSidebar/BottomNav/TopBar, StatCard, DataTable,
                   OrderStatusBadge, OrderFilters, Pagination,
                   StatusUpdater, MenuManager, MenuItemDialog,
                   CategoryManager, ImageUploader, RangeFilter,
                   LoginForm, ChangePasswordForm
  lib/
    auth/          password, session, guard
    dashboard/     stats, date-range
    orders/        create-order, order-number
    storage/       types, local, cloudinary, s3, index
    validation/    schemas (Zod)
    db.ts money.ts rate-limit.ts utils.ts
  server/actions/  auth, checkout, menu, categories, orders
  store/cart.tsx   client cart (reducer + localStorage)
  proxy.ts         admin redirect fast path
```

---

## 12. Assumptions

- **Currency and locale** — Philippine Peso, `en-PH` formatting, server-local time for
  order numbers and "today". A shop operating across time zones would need an explicit
  business time zone.
- **Phone numbers** — validated as PH mobile (`09XXXXXXXXX` or `+639XXXXXXXXX`) and
  normalised to the `09…` form.
- **Revenue** — every status except `CANCELLED` counts toward sales, since the shop has
  committed once it accepts the order. Completed-only sales are reported alongside.
  Adjust `REVENUE_STATUSES` in `src/lib/dashboard/stats.ts` to change this.
- **No delivery fee** in the MVP, so `total` equals `subtotal`. They are separate
  columns so a fee, discount or tax can be added without a migration.
- **Rate limiting is in-process**, which is enough for one instance. Behind more than
  one, replace the body of `src/lib/rate-limit.ts` with Redis — callers depend only on
  the `check()` signature.
- **Deleting a category is blocked** while it still holds items; the alternative would
  either orphan them or cascade into a surprise bulk delete.
- **Order lookup is by order number**, which is guessable. Fine for a small shop where
  the page only shows what the customer already knows; add a random token to the URL if
  that matters.
- **Seed photos** are hot-linked from Unsplash for convenience. Replace them with
  uploads before going live.
- Known Next.js behaviour: `notFound()` on a dynamically-rendered route shows the
  not-found page but leaves the HTTP status at 200, because the response shell has
  already been flushed. Unmatched routes still return a real 404.

---

## 13. Recommended next features

Deliberately left out of the MVP; the architecture accommodates each without rework.

1. **Realtime order board** — the kitchen view is the obvious next win. Poll
   `/admin/orders` or add SSE; statuses and timestamps are already modelled.
2. **Order notifications** — SMS or email on status change. `customerPhone` and
   `customerEmail` are captured; add a notification service beside `server/actions`.
3. **Online payment** — GCash / Maya / card. Add a `Payment` model referencing `Order`
   and a status hook; totals are already computed and frozen server-side.
4. **Customer accounts and reorder** — `Order` already stores enough to build order
   history keyed by phone number.
5. **Shop hours and pre-orders** — accept orders only during opening hours, or schedule
   for a pickup time.
6. **Stock counts** — a `stockQuantity` on `MenuItem` decremented inside the existing
   order transaction, which already re-checks availability atomically.
7. **Discounts and coupons** — the `subtotal`/`total` split exists precisely so a
   discount line can be introduced without a migration.
8. **Printable receipts** — a print stylesheet over the existing order detail page.
9. **Staff roles** — the `Role` enum has `STAFF`; add per-route checks in
   `requireAdmin()`.
10. **Multi-branch** — a `Branch` model with `MenuItem` and `Order` scoped to it.
