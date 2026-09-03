# StockBuddy POS — Claude Code Context

## Project Overview
Lightweight cloud-based POS, inventory, and business intelligence platform for small F&B
businesses (cafes, bubble tea shops, casual dine-in restaurants). Think Revel POS but simpler,
more affordable, and with a built-in AI insights layer powered by OpenAI.

Two account types: **admin** (owner/manager) and **staff** (cashier/floor staff).

**Stack:** Next.js 14 (App Router) · React · Tailwind CSS · Supabase (auth + db + realtime) · OpenAI API

---

## Commands
```bash
npm run dev        # start dev server
npm run build      # production build
npm run lint       # lint check
supabase start     # start local Supabase (if using local dev)
supabase db push   # push schema changes
```

---

## Core Business Rules (never violate these)
- All data is scoped to the logged-in admin — admins never see each other's data
- Staff cannot log in unless status = `active`
- Staff cannot access any admin-only routes (reports, menu management, settings, staff panel)
- Stock decrements atomically when an order is completed — validate server-side, never client-only
- Orders are blocked if any item's requested quantity exceeds available stock
- Stock quantity can never go below zero
- Orders must contain at least one item
- KDS and table status updates must use Supabase Realtime — no polling
- Categories must exist before products can be added
- Products must belong to a category owned by the current admin
- Admin API key (OpenAI) is stored per admin in settings, never hardcoded

---

## Data Entities
- `admins` — main account, owns all scoped data
- `staff` — linked to one admin, has status: pending | active | suspended
- `shifts` — clock-in/out records linked to staff
- `tables` — dine-in tables with status: available | occupied | reserved
- `categories` — menu groupings, scoped per admin
- `products` — belong to a category, have name, price, description, image, stock, availability toggle
- `orders` — created by staff or admin, type: dine-in | takeaway, linked to table if dine-in
- `order_items` — line items in an order (product + quantity + price at time of order)
- `payments` — payment records per order, method: cash | card | grabpay | paynow | wechatpay
- `kds_tickets` — order cards shown in kitchen display, have status: pending | preparing | ready

---

## App Modules & Pages

### Public
- `/` — Marketing homepage
- `/login` — Admin and staff login
- `/register` — Admin registration only

### Staff Area (authenticated, staff + admin)
- `/pos` — Main POS order-taking screen (categories → products → order → payment)
- `/tables` — Visual table floor plan with status indicators
- `/kds` — Kitchen Display System (full-screen, realtime order cards)

### Admin Area (authenticated, admin only)
- `/dashboard` — Summary stats + AI weekly digest + Ask Your Data input
- `/menu` — Category and product management
- `/menu/categories` — CRUD for categories
- `/menu/products` — CRUD for products, availability toggle, stock adjustment
- `/orders` — Order history and detail view
- `/reports` — Full reporting area (sales, products, payments, staff, peak hours, export CSV)
- `/staff` — Staff list, approval/suspension actions, shift history
- `/settings` — Table configuration, OpenAI API key input, general settings

---

## AI Features (OpenAI API — GPT-4o)
Admin provides their OpenAI API key once in `/settings`. Stored per admin in the database.
All AI calls are made server-side via Next.js API routes — never expose the key client-side.

Three features:
1. **Ask Your Data** — chat input on dashboard, admin asks plain-language questions about their
   business data. Fetch relevant aggregated data first, then send to OpenAI with context.
2. **Smart Restock Alerts** — daily automated check, compares sales velocity to stock levels,
   generates a natural-language alert if items are running low (e.g. "Taro Milk Tea will run
   out in ~2 days at current sales rate").
3. **Weekly Business Digest** — generated every Monday, summarises prior week: revenue trend,
   top sellers, busiest periods, notable changes. Shown as a card on the dashboard.

Never send raw database dumps to OpenAI — always pre-aggregate and summarise data first
to minimise token usage and cost.

---

## Realtime Requirements
These features MUST use Supabase Realtime channels, not polling:
- KDS ticket updates (new orders appearing, status changes)
- Table status changes (available → occupied → available)

---

## UI & Design Direction
**Feel:** Between StockBuddy's clean light-blue and a deeper professional tool. Calm, trustworthy,
fast. A real cafe owner should feel comfortable handing this to staff on day one.

- **Backgrounds:** Soft blue-white (`#EFF6FF`, `#DBEAFE`) for main content areas
- **Sidebar & panels:** Deep navy-blue (`#1E3A5F` to `#1E40AF`)
- **Primary accent:** Cyan-teal (`#0EA5E9`) for buttons and active states
- **Text:** Near-black on light, white on dark panels
- **Components:** Rounded cards, subtle shadows, clean data tables, smooth transitions
- **POS screen:** Optimised for tablet use — large tap targets, category grid, clear order panel
- **KDS screen:** Full-screen dark mode, high contrast, readable from across a kitchen

---

## Route Protection Rules
- `/dashboard`, `/menu`, `/orders`, `/reports`, `/staff`, `/settings` — admin only
- `/pos`, `/tables`, `/kds` — staff and admin
- All protected routes redirect to `/login` if not authenticated
- Use Next.js middleware for route protection, not page-level checks

---

## Supabase Notes
- Use Row Level Security (RLS) on all tables — admin data scope enforced at DB level
- Staff approval status check must happen at auth layer, not just UI
- Use Supabase Realtime for KDS and table status — set up channels in layout components
- Order completion and stock decrement should use a Supabase RPC function (atomic transaction)

---

## Working Style
- Build one module at a time, wait for confirmation before moving to the next
- Do not generate placeholder or dummy data unless explicitly asked
- Ask before making architectural decisions not covered in this file
- Always validate stock and order logic server-side
- Never expose the OpenAI API key client-side
