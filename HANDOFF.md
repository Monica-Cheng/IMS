# StockBuddy POS — Project Handoff

**Status of this document:** authoritative as of 2026-09-04. Written from a full code + schema audit (`PROJECT_AUDIT.md`, git HEAD `71f18c6`), not from memory or from chat history.

**Supersedes:** `STOCKBUDDY_HANDOFF.md` (the pre-rebuild spec). That document describes a *different product* — see §2. Do not follow it. Keep it only as historical reference.

**How to use this:** put this file at the repo root. In a new AI chat, attach it and say "read this completely before proposing changes."

---

# 1. What this project is

**StockBuddy POS** (`stockbuddy-pos` in `package.json`; the repo folder is named `IMS` — cosmetic mismatch, pick one name and fix it).

A multi-tenant point-of-sale and inventory web app for small food & beverage businesses. Each business ("admin") signs up, gets a unique 8-character business code, and their staff self-register with that code. Staff take orders on a POS screen, orders flow to a kitchen display, stock decrements on completion.

**Two goals, in priority order:**
1. **Resume/portfolio project.** This is the primary target. It needs to demo cleanly, be explainable in an interview, and be live somewhere.
2. Eventual real use by a family F&B business. Secondary — do not let it dictate scope now.

**Timeline:** one to two weeks of focused work.

---

# 2. Important: this is not the old project

The previous handoff described a single-business inventory system built on Node/Express + MySQL, whose defining feature was **stock deployment** — separating "stock you own" (storeroom) from "stock allocated to the POS" (counter), with deploy/undeploy moving quantities between them.

**None of that exists in the current codebase.** Verified absent: no deployment tables, no deploy/undeploy concept, no MySQL, no Express. `products.stock` is a single integer. The nearest surviving idea is the `is_available` boolean.

What replaced it, and was clearly a deliberate direction change:

| Old spec | Current build |
|---|---|
| MySQL + Express + XAMPP | Supabase (hosted Postgres) + Next.js Server Actions, no separate server |
| React CRA / Vite | Next.js 14 App Router |
| Single business, no multi-tenancy | Multi-tenant: `admin_id` on every table, RLS-enforced |
| bcrypt + session middleware | Supabase Auth + Row Level Security |
| Storeroom/counter deployment | Flat `products.stock` integer |
| No tables, no kitchen | Dining tables, floor view, KDS with realtime |
| Admin creates staff accounts | Staff self-register with a business code, admin approves |

**Decision needed:** confirm the deployment concept is dropped for good. My recommendation is yes — drop it. It was the most distinctive business rule in the old spec, but re-introducing it now means a schema change, new UI, and new logic in the middle of a two-week sprint, and it does not make the project more impressive to an interviewer. The multi-tenant + RLS + realtime story is stronger.

---

# 3. Stack

- **Framework:** Next.js 14.2.15, App Router, React 18, TypeScript strict.
- **Backend:** none separate. All server logic is Next.js Server Actions (`"use server"`), plus one route handler at `src/app/auth/callback/route.ts`. Supabase is the entire backend.
- **Database:** Supabase hosted Postgres. Project `derxzbqvcbbnjobdqims`.
- **Data access:** `@supabase/ssr`. Browser client, cookie-bound server client, and a middleware session-refresh helper. **Every client uses the anon key. There is no service-role key anywhere.** RLS is the only data-access boundary — this is deliberate.
- **Auth:** Supabase Auth, email + password, email confirmation via `exchangeCodeForSession`.
- **Styling:** Tailwind 3.4. Design tokens are defined in `tailwind.config.ts` but almost every component hardcodes hex classes (`bg-[#0EA5E9]`) and ignores them.
- **Package manager:** npm.
- **Routes:** route groups `(admin)` and `(staff)` for layout and role separation.

---

# 4. Architecture decisions already made (do not silently change these)

These were recovered from the code. A newcomer would not guess them.

1. **Role is determined by table membership, not a column.** There is no `role` field on any app table. A given `auth.users` id is an admin if an `admins` row exists with that id, or staff if a `staff` row does. Both tables use the auth uid as their primary key.

2. **`get_my_admin_id()` is the tenant key for everything.** Admin → own uid. *Active* staff → their `admin_id`. Pending, suspended, or anonymous → NULL, which makes every RLS check fail closed. It is used both to populate `admin_id` on insert and inside nearly every RLS policy.

3. **Staff onboarding is self-service plus approval.** Staff register with the business code, are created `status='pending'` by a `SECURITY DEFINER` RPC, and are signed out immediately. They cannot log in until an admin activates them. This is enforced in four independent places: the login action, `middleware.ts`, `(staff)/layout.tsx`, and `get_my_admin_id()`.

4. **Order lifecycle is payment-first, stock-last.** `submitOrder` creates the order as `pending`, records the payment, and creates a KDS ticket. Stock is decremented only later, when the kitchen advances the ticket `preparing → ready`, which calls the `complete_order()` RPC. That RPC validates stock, decrements it, marks the order completed, and sets the ticket ready — in one transaction. **"preparing" is a KDS ticket status, never an order status.** See §6 for why this ordering is a problem.

5. **Realtime is "notify then refetch."** Both `TablesClient` and `KDSClient` subscribe to `postgres_changes` and simply call `router.refresh()` on any event. No client-side merging of payloads.

6. **Route protection is deliberately triple-layered:** middleware, then per-page `getUser()` checks, then per-layout checks.

7. **Nothing frees a table automatically.** Dine-in checkout marks a table occupied; it returns to available only when someone taps it on `/tables`.

8. **The floor plan is not spatial.** `shape`, `area_name`, `row_position`, `column_position` exist on `tables`, but `/tables` renders a plain responsive CSS grid. Shape only changes border-radius. No drag, no absolute positioning.

---

# 5. What is done

Nothing is marked fully verified, because the audit could not establish an authenticated session — so no logged-in flow was exercised end to end. "Built" below means the code exists and the app builds and serves it.

**Built and believed working:**
- Admin registration, staff registration by business code, login, logout, email confirmation callback
- Role separation and route protection (unauthenticated redirect verified working)
- Staff management: approve, suspend, reactivate; business code display and copy
- Categories CRUD (delete correctly traps the foreign-key error with a friendly message)
- Products CRUD, availability toggle
- POS: category grid → product grid, filtered to available and in-stock; cart with quantity controls
- Checkout: creates order, order items, KDS ticket, payment row; marks table occupied
- Order history with expandable detail
- KDS: ticket list, pending → preparing → ready, realtime subscription
- Tables: floor view, status changes, realtime; admin table configuration at `/tables/manage`
- Payment method capture (cash, card, grabpay, paynow, wechatpay)
- Dashboard with four count tiles

**Database:** 10 tables, 7 enums, RLS enabled on all tables with policies written, 7 functions including the `complete_order()` RPC, one trigger, 16 indexes, 4 migrations.

**The app builds and starts.** Verified: `npm run build` succeeds, `npm run start` serves, `/login` returns 200, unauthenticated `/dashboard` redirects to `/login`.

---

# 6. What is broken or missing — ranked

## Tier 0 — do these first, they are cheap and they are the difference between a demo and an embarrassment

**0.1 Nothing is in git.** `git ls-files` returns exactly one file: `README.md`. The entire application is untracked. There is no history, no baseline, no backup. One bad command loses everything. **Commit before touching anything else.** Confirm `.env.local` stays gitignored.

**0.2 The build is broken as it sits on disk.** `node_modules/@next/swc-darwin-arm64` is missing its 115 MB native binary. `npm install` does not fix it. The fix is `rm -rf node_modules && npm install`. Document this in the README.

**0.3 `/reports` and `/settings` are empty `<div />` — and both are linked in the sidebar.** An interviewer or a demo viewer will click them. Either build them or remove the links. Removing the links takes two minutes.

## Tier 1 — correctness bugs that are also your best interview material

**1.1 Checkout trusts client-supplied prices.** `submitOrder` writes `order_items.unit_price` and `orders.total_amount` straight from the browser payload. The server never re-reads `products.price` or recomputes the total. A crafted request can set any price at or above zero. This is a real vulnerability and a five-minute story in an interview: re-read prices server-side from `products`, recompute the total, ignore what the client sent.

**1.2 Checkout performs no stock check at all, and this strands paid orders.** This is the most important defect in the project. Walk the failure:

- `submitOrder` never checks or reserves stock. Any number of orders for the last remaining unit can be created *and paid*.
- Later, at the KDS "mark ready" step, `complete_order()` runs. Two concurrent calls both pass its unlocked `IF EXISTS` stock check. The first commits `stock = 0`. The second blocks on the row lock, re-reads, computes `-1`, and violates `CHECK (stock >= 0)`, so the whole RPC raises.
- Net: stock is never oversold — the CHECK constraint holds. **But the second customer has already paid**, and their order sits stranded in pending or preparing with no automatic cancel and no refund path anywhere in the UI.

Two fixes, do both:
- Check and reserve stock inside `submitOrder`, before taking payment.
- Add `SELECT … FOR UPDATE` to the stock check inside `complete_order()` so the check and the decrement are under the same lock, instead of relying on the CHECK constraint to catch it after the fact.

**1.3 Two admin paths mutate stock unsafely.**
- `adjustProductStock()` is a read-modify-write in JavaScript: read stock, add delta, write. Concurrent adjustments lose updates. Move it into a Postgres function doing `UPDATE products SET stock = stock + $1`.
- `updateProduct()` writes `stock` directly from a form field — a blind overwrite that clobbers any concurrent change, including in-flight sales. **Remove the stock field from the edit form entirely.** Stock should only change through adjustment and sales, never through a product-details save.

**1.4 Schema source of truth is ambiguous.** There are four incremental migrations *and* a hand-assembled `supabase/reset_schema.sql` dated later. They are reconcilable but not identical: the reset file adds `pgcrypto` and **silently drops the two `ALTER PUBLICATION supabase_realtime ADD TABLE` lines**. If the live database was built from the reset file, **realtime is dead on `tables` and `kds_tickets`, and there is no polling fallback** — the KDS and floor plan just never update. Check Database → Replication in the Supabase dashboard. Then delete one of the two files so there is a single source of truth.

## Tier 2 — worth doing if time allows

- **Reports.** Highest resume value per hour of anything left. Revenue today and this week, top products, orders by payment method. You already have `orders`, `order_items`, and `payments` — the data is there. Keep it to a few numbers and one chart.
- **Dashboard "orders today" uses UTC midnight.** Wrong for a Singapore business. Use the business timezone.
- **`NEXT_PUBLIC_SITE_URL` is unset**, so confirmation emails hardcode `localhost:3000`. This must be fixed before deploying, or nobody can confirm an account on the live site.
- **Staff status actions swallow errors** — bare `return` on failure, admin sees nothing.
- **`parseNumber` / `parseInteger` silently fall back to 0**, so a malformed price becomes 0.00.
- **Password confirmation is client-only**; the server actions never compare the two fields.
- **Deploy to Vercel.** A live URL on a resume is worth more than another feature.

## Tier 3 — dead weight to delete or decide on

- Empty leftover route dirs: `src/app/kds/`, `src/app/pos/`, `src/app/tables/`. Delete.
- `src/app/(admin)/orders/` has no `page.tsx`, only `OrdersClient.tsx`, which the staff page imports across route groups. Works, but misleading.
- `is_admin()` SQL function: defined, never called.
- `order_status = 'in-progress'`: reserved in the enum, tolerated by `complete_order`, never written.
- Two business-code generators — one in SQL as the column default, one in JS that bypasses it.
- Legacy-`admins`-schema fallback code in `src/lib/supabase/admins.ts`. Either load-bearing or dead; only the live DB can tell you which.
- `types.ts` is hand-authored to imitate `supabase gen types` output. It can drift silently from the real schema. Consider generating it for real.
- `.DS_Store` files in the working tree (gitignored, just noise).

---

# 7. Explicitly out of scope

Cut these. They do not serve a two-week resume-ready target, and half-built features look worse than absent ones.

- **All three AI features** (Ask Your Data, Smart Restock Alerts, Weekly Business Digest). No code exists. The `admins.openai_api_key` column is never read or written. Either drop the column or leave it documented as unused.
- **`shifts` / clock-in-out.** Full table, indexes, and three RLS policies exist with zero code references. Drop the table or leave it dormant and documented.
- **Spatial drag-and-drop floor plan.** The positioning columns exist; the grid is fine.
- Refunds and split payments, receipt printing, discounts and promotions, customer CRM, product modifiers and variants, multi-branch, cost/COGS and true profit reporting, CSV export.

**On profit:** there is no cost field on `products`. Any reporting can show **revenue only**. Do not label it profit.

---

# 8. Suggested two-week plan

**Days 1–2 — stabilize.** Commit everything to git. Fix the node_modules build. Answer the open questions in §9. Delete dead directories. Remove or stub the `/reports` and `/settings` sidebar links.

**Days 3–6 — correctness.** Server-side price recomputation in `submitOrder`. Stock check and reservation at order time. `SELECT … FOR UPDATE` in `complete_order()`. Move `adjustProductStock` into a Postgres function. Remove the stock field from the product edit form. Reconcile the schema files.

**Days 7–9 — the demo gap.** Build a minimal `/reports`: revenue today and this week, top five products, orders by payment method. Fix the dashboard timezone. Build a minimal `/settings` or remove it.

**Days 10–12 — ship.** Set `NEXT_PUBLIC_SITE_URL`. Deploy to Vercel. Seed a realistic demo dataset. Walk the full flow on the live site: register, approve staff, create menu, take an order, kitchen completes it, check the report.

**Days 13–14 — polish.** README with screenshots and an architecture note. Write out the resume bullet. Practice explaining RLS multi-tenancy, the order lifecycle, and the concurrency fix.

---

# 9. Open questions you need to answer

1. Is realtime actually enabled on `tables` and `kds_tickets` in the live project? (Supabase dashboard → Database → Replication.)
2. Which schema is deployed — the four migrations, or `reset_schema.sql`?
3. Does the live `admins` table still have the pre-`business_code` shape that the fallback code guards against? If not, delete the fallback.
4. Is there real business data in any table, or is it all empty? (Needs an admin login or the service-role key.)
5. Confirm: deployment/undeployment is dropped permanently?
6. Confirm: AI features and `shifts` are cut?
7. Was an admin `/orders` page intended, or is the cross-group import fine?
8. Is `order_status = 'in-progress'` meant to be wired up, or deleted from the enum?

---

# 10. Working agreement for AI assistance

The owner is learning while building. An assistant on this project should:

- Work one milestone at a time and stop for testing before moving on.
- Give exact file paths and exact commands, and say what output to expect.
- Explain what each change does and why, especially schema and RLS changes.
- Never assume something works without evidence. "It builds" is not "it works."
- Never silently redesign a decision listed in §4.
- Read existing code before overwriting it.

**Starter prompt for a new chat:**

> Read `HANDOFF.md` completely before proposing or changing any code. It is an audit-verified description of the current state — treat it as authoritative over your assumptions. This is StockBuddy POS: a multi-tenant restaurant POS on Next.js 14 App Router and Supabase, using anon key plus RLS with no service-role key. Do not reintroduce the stock deployment concept from the old spec. I have about two weeks and the goal is resume-ready, not production. Start with Tier 0 in section 6 only, and stop when it's done so I can verify.

---

# 11. Resume framing

> **StockBuddy POS — Multi-tenant Point-of-Sale & Inventory System**
> Next.js 14 (App Router) and Supabase/Postgres application serving multiple independent businesses from one deployment. Tenant isolation enforced entirely through Row Level Security with no service-role key; self-service staff onboarding with admin approval; realtime kitchen display; transaction-safe stock decrement via a Postgres function with row-level locking.

The things worth being able to explain in an interview:
- Why tenant isolation lives in RLS rather than application code, and what fails closed when `get_my_admin_id()` returns NULL.
- The order lifecycle, and specifically why decrementing stock at kitchen-ready time instead of at checkout created a paid-but-unfulfillable order — and how you fixed it.
- Why a read-modify-write on a stock column is a bug, and what `SELECT … FOR UPDATE` changes.
- Why the server must never trust a client-supplied price.
