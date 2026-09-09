# About the App

## What it is

A mobile-first web app that lets customers browse a snack and breakfast menu and place an order from their phone — no account required. The shop owner manages the menu, prices, availability, and incoming orders from a simple admin dashboard on the same device.

Now installable to a phone's home screen as a Progressive Web App (PWA), so customers can open it like a native app.

---

## Purpose

Small food shops (breakfast stalls, canteens, snack corners) typically lose orders to:

- Long chat threads on Facebook Messenger or Viber
- Handwritten lists that get lost or misread
- Missed calls during rush hours
- No visibility into what's selling or how much came in today

This app replaces all of that with:

- **One shareable link** the shop posts to their GC or bio
- **Structured orders** with clean line items, totals, and contact info
- **A live dashboard** the owner checks between customers
- **Zero infrastructure lock-in** — runs on any Node.js host with a PostgreSQL database

Prices are in **Philippine Pesos (₱)**, phone numbers validated as PH mobile, but the code is not otherwise region-locked.

---

## Who it's for

| Role | What they do |
| --- | --- |
| **Customer** | Opens the link, browses the menu, adds to cart, checks out with name + phone. No sign-up. |
| **Shop owner / admin** | Signs in at `/admin`, manages menu and categories, watches orders come in, advances them through statuses (Pending → Preparing → Ready → Completed). |
| **Staff** (future) | Role exists in the schema; per-route restrictions can be added when needed. |

---

## Core features

### For customers

- Scrollable menu with sticky category navigation
- Item cards with photo, description, price, and availability badge
- Cart persists across page reloads (survives closing the tab)
- Prices and availability re-checked when the cart opens (no stale surprises at checkout)
- Pickup or delivery option; address field appears only when delivery is chosen
- Order confirmation page with live status, reachable by order number

### For the shop

- Dashboard: today's orders, sales, pending count, average order value, best sellers, busiest day
- Orders list: search by number/name/phone, filter by status, filter by date, pagination
- Menu CRUD: inline price edit, one-tap availability toggle, photo upload or URL paste
- Categories: create, reorder, hide, delete (blocked if items exist)
- Change password from Settings

### PWA (installable app)

- Manifest and icons served by the Next.js app itself
- iOS: Safari → Share → **Add to Home Screen**
- Android: Chrome → menu → **Install app**
- Launches standalone (no browser chrome), uses the shop's theme color

---

## Technical specs

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Language | TypeScript 5.9 (strict, `noUncheckedIndexedAccess`) |
| UI | React 19, Tailwind CSS v4, Radix UI, lucide-react, sonner |
| Database | PostgreSQL 17 |
| ORM | Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| Validation | Zod 4 |
| Auth | `jose` (HS256 JWT in an HttpOnly cookie) + `bcryptjs` |
| Image storage | Local disk, Cloudinary, or S3-compatible (swappable via env var) |

### Design principles

- **Money is integer centavos** end-to-end (₱1 = 100). No floats, no `Decimal` serialization drama.
- **Server never trusts the client for money.** Checkout payload sends item IDs and quantities only; every price and total is re-read from the database.
- **Historical accuracy.** Order line items snapshot product name and price at order time. Deleting a menu item never breaks past orders.
- **Idempotent order submission.** Duplicate submits return the original order rather than creating two.
- **Mobile-first throughout.** Every admin screen also works on a phone.

### Security

- Passwords hashed with bcrypt (cost 12)
- Session cookie: HS256-signed JWT, HttpOnly, SameSite=Lax, Secure in production
- Every admin page calls `requireAdmin()`; every mutating action calls `requireAdminAction()`
- CSRF covered by SameSite=Lax + Next.js Server Action origin checking
- All input Zod-validated server-side
- Rate-limited order submission (default: 8 per 10 minutes per IP)
- Order confirmation pages are `noindex` (they carry customer PII)

### Verified

`npm run smoke` runs 37 end-to-end checks against a live server and real database: route protection, forged cookies, server-side pricing, tampered payloads, idempotency, quantity validation, historical price preservation, deletion safety, and dashboard arithmetic.

---

## Requirements

- **Node.js** (version compatible with Next.js 16)
- **PostgreSQL 17** (Docker Compose file included for local dev)
- A file storage target if not using local disk (Cloudinary account or any S3-compatible bucket)

---

## Not included (by design — see README §13 for the roadmap)

- Online payment integration
- Realtime kitchen board (currently polled via page refresh)
- Customer accounts / reorder history
- SMS or email notifications
- Stock counts
- Discount codes
- Multi-branch support
