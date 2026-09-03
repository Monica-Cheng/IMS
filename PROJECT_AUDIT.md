# PROJECT_AUDIT.md

Factual audit of the repository at `/Users/monicacheng/IMS`.
Date: 2026-09-04. Git HEAD: `71f18c6` ("Initial commit").
Method: full read of every file in `src/`, `supabase/`, and root config; production build + start; REST probe of the live Supabase project with the only key available (anon/publishable).

Everything below is what could be verified from the code, the SQL, and a build/run. Where something could not be verified it is marked as such. Nothing here is aspirational.

---

## 0. What this project actually is

- **Name:** `stockbuddy-pos` (from `package.json` line 2: `"name": "stockbuddy-pos"`). `CLAUDE.md` calls it "StockBuddy POS". The repo folder and `README.md` say "IMS" — cosmetic mismatch only.
- **Datastore:** Supabase (hosted Postgres). `.env.local` points at `https://derxzbqvcbbnjobdqims.supabase.co`. All access is through `@supabase/supabase-js` / `@supabase/ssr`. No MySQL, no other DB, no ORM.
- **Is this the active rebuild?** Yes. This is a single Next.js 14 App Router codebase using the current Supabase SSR pattern. There is **no** abandoned-prototype structure: no `public/` folder of vanilla-HTML admin pages, no Create React App `client/`, no `database/createDB.js`. You are in the right directory.
- **Two abandoned *empty* directories do exist** inside this codebase (not a separate prototype): `src/app/kds/`, `src/app/pos/`, `src/app/tables/` — all empty, dated 2026-04-01, superseded by `src/app/(staff)/…`. See §5.

---

## 1. STACK

Quoting `package.json`:

```json
"dependencies": {
  "@supabase/ssr": "^0.10.0",
  "@supabase/supabase-js": "^2.45.4",
  "next": "14.2.15",
  "react": "^18",
  "react-dom": "^18"
},
"devDependencies": {
  "@types/node": "^20", "@types/react": "^18", "@types/react-dom": "^18",
  "autoprefixer": "^10.0.1",
  "eslint": "^8", "eslint-config-next": "14.2.15",
  "postcss": "^8",
  "tailwindcss": "^3.4.1",
  "typescript": "^5"
}
```

- **Frontend framework:** Next.js **14.2.15**, App Router (`src/app/`), React 18. TypeScript `^5`, `"strict": true` (`tsconfig.json`). Route groups `(admin)` and `(staff)` for layout/role separation.
- **Separate backend server:** none. All server logic is Next.js **Server Actions** (`"use server"` files: `src/app/auth/actions.ts`, `src/app/(admin)/menu/actions.ts`, `src/app/(admin)/staff/actions.ts`, `src/app/(admin)/tables/manage/actions.ts`, `src/app/(staff)/pos/actions.ts`, `src/app/(staff)/tables/actions.ts`, `src/app/(staff)/kds/actions.ts`) plus exactly **one** route handler: `src/app/auth/callback/route.ts`. Supabase is the entire backend.
- **How the client talks to the DB:** `@supabase/ssr`. `src/lib/supabase/client.ts` = `createBrowserClient` (browser); `src/lib/supabase/server.ts` = `createServerClient` with Next cookie adapter (RSC + actions); `src/lib/supabase/middleware.ts` = per-request session refresh. **Every** client is constructed with `NEXT_PUBLIC_SUPABASE_ANON_KEY`. There is **no service-role key anywhere** in the repo. Row Level Security is the only data-access boundary. Realtime uses `supabase.channel().on("postgres_changes", …)` in `TablesClient.tsx` and `KDSClient.tsx`.
- **Auth method:** Supabase Auth, email + password. `signInWithPassword` / `signUp` in `src/app/auth/actions.ts`; email-confirmation handled by `src/app/auth/callback/route.ts` (`exchangeCodeForSession`). Sessions are cookies, refreshed in `middleware.ts` → `updateSession()`. Roles are not a Supabase feature here — see §8.
- **Styling:** Tailwind CSS `^3.4.1` (`tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css` is just the three `@tailwind` directives). `tailwind.config.ts` defines design tokens (`background`, `sidebar`, `accent`, …) from `CLAUDE.md`, but almost all components hardcode hex utility classes (`bg-[#0EA5E9]`, `text-[#1E3A5F]`, …) and ignore the tokens.
- **Package manager:** **npm**. `package-lock.json` present (lockfile v3, 221 KB). No `yarn.lock`, no `pnpm-lock.yaml`. This environment runs Node **v24.3.0**, npm 11.4.2 (Next 14.2.15 predates Node 24; it works once the native SWC binary is present — see §6).

---

## 2. DATABASE

Source of truth: `supabase/migrations/` (4 files) + a divergent standalone `supabase/reset_schema.sql`. There is **no `supabase/config.toml`**. The live schema could not be introspected (no privileged key). Everything below is from the SQL files.

### 2.1 Migrations, in order

| # | File | Purpose |
|---|------|---------|
| 1 | `20260331000000_initial_schema.sql` | All enums, all 10 tables, indexes, helper functions, `set_updated_at` trigger, full RLS enable + policies, `complete_order()` RPC, adds `tables` and `kds_tickets` to the `supabase_realtime` publication |
| 2 | `20260331000001_add_business_code.sql` | `admins.name` + `admins.business_code` (unique, `NOT NULL`, `DEFAULT generate_business_code()`); `generate_business_code()`; `register_staff()` RPC (SECURITY DEFINER) |
| 3 | `20260401000002_add_business_code_validation.sql` | `business_code_exists()` (SECURITY DEFINER, for public staff signup) |
| 4 | `20260401000003_add_table_configuration_fields.sql` | enum `table_shape`; `tables.shape` / `area_name` / `row_position` / `column_position` |

**`supabase/reset_schema.sql`** (dated 2026-04-27, newer than every migration and same date as `.env.local`) is a hand-merged "brand-new project" bootstrap. It folds in all 4 migrations and adds `CREATE EXTENSION pgcrypto`, **but it omits the two `ALTER PUBLICATION supabase_realtime ADD TABLE …` statements**. If the live database was provisioned/reset from this file, Realtime is **not** enabled on `tables` or `kds_tickets`. This is unverifiable here and is an open question (§7).

### 2.2 Enums

| Enum | Values | Defined in |
|------|--------|-----------|
| `staff_status` | `pending`, `active`, `suspended` | migration 1 |
| `table_status` | `available`, `occupied`, `reserved` | migration 1 |
| `order_type` | `dine-in`, `takeaway` | migration 1 |
| `order_status` | `pending`, `in-progress`, `completed`, `cancelled` | migration 1 |
| `payment_method` | `cash`, `card`, `grabpay`, `paynow`, `wechatpay` | migration 1 |
| `kds_status` | `pending`, `preparing`, `ready` | migration 1 |
| `table_shape` | `square`, `rectangle`, `round` | migration 4 |

Note: `order_status = 'in-progress'` is accepted by `complete_order()`'s completable-state check but is **never written by any code path**. Dead value (defensive only).

### 2.3 Tables (all columns, types, defaults, nullability, keys, constraints)

Nullability: "NOT NULL" listed explicitly; otherwise the column is nullable.

**`admins`**
| Column | Type | Null / Default | Notes |
|---|---|---|---|
| `id` | uuid | NOT NULL | **PK**; **FK** → `auth.users(id)` ON DELETE CASCADE |
| `email` | text | NOT NULL | |
| `business_name` | text | nullable | |
| `openai_api_key` | text | nullable | **never read or written by any code** (§5) |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` | |
| `name` | text | nullable | added migration 2 |
| `business_code` | text | NOT NULL (after backfill), DEFAULT `generate_business_code()` | **UNIQUE**; added migration 2 |

**`staff`**
| Column | Type | Null / Default | Notes |
|---|---|---|---|
| `id` | uuid | NOT NULL | **PK**; **FK** → `auth.users(id)` ON DELETE CASCADE |
| `admin_id` | uuid | NOT NULL | **FK** → `admins(id)` ON DELETE CASCADE |
| `name` | text | NOT NULL | |
| `email` | text | NOT NULL | |
| `status` | `staff_status` | NOT NULL, DEFAULT `'pending'` | |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` | |

**`shifts`** — *table exists; zero code references anywhere (§5).*
| Column | Type | Null / Default | Notes |
|---|---|---|---|
| `id` | uuid | NOT NULL, DEFAULT `gen_random_uuid()` | **PK** |
| `admin_id` | uuid | NOT NULL | **FK** → `admins(id)` CASCADE |
| `staff_id` | uuid | NOT NULL | **FK** → `staff(id)` CASCADE |
| `clock_in` | timestamptz | NOT NULL, DEFAULT `now()` | |
| `clock_out` | timestamptz | nullable | |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` | |

**`tables`**
| Column | Type | Null / Default | Notes |
|---|---|---|---|
| `id` | uuid | NOT NULL, DEFAULT `gen_random_uuid()` | **PK** |
| `admin_id` | uuid | NOT NULL | **FK** → `admins(id)` CASCADE |
| `name` | text | NOT NULL | |
| `capacity` | integer | nullable | |
| `status` | `table_status` | NOT NULL, DEFAULT `'available'` | |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` | |
| `shape` | `table_shape` | NOT NULL, DEFAULT `'square'` | migration 4 |
| `area_name` | text | nullable | migration 4 |
| `row_position` | integer | NOT NULL, DEFAULT `0` | migration 4 |
| `column_position` | integer | NOT NULL, DEFAULT `0` | migration 4 |

**`categories`**
| Column | Type | Null / Default | Notes |
|---|---|---|---|
| `id` | uuid | NOT NULL, DEFAULT `gen_random_uuid()` | **PK** |
| `admin_id` | uuid | NOT NULL | **FK** → `admins(id)` CASCADE |
| `name` | text | NOT NULL | |
| `sort_order` | integer | NOT NULL, DEFAULT `0` | |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` | |

**`products`**
| Column | Type | Null / Default | Notes |
|---|---|---|---|
| `id` | uuid | NOT NULL, DEFAULT `gen_random_uuid()` | **PK** |
| `admin_id` | uuid | NOT NULL | **FK** → `admins(id)` CASCADE |
| `category_id` | uuid | NOT NULL | **FK** → `categories(id)` **ON DELETE RESTRICT** |
| `name` | text | NOT NULL | |
| `description` | text | nullable | |
| `price` | numeric(10,2) | NOT NULL | **CHECK (`price >= 0`)** |
| `image_url` | text | nullable | |
| `stock` | integer | NOT NULL, DEFAULT `0` | **CHECK (`stock >= 0`)** — the only real oversell backstop (§5) |
| `is_available` | boolean | NOT NULL, DEFAULT `true` | |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` | |

**`orders`**
| Column | Type | Null / Default | Notes |
|---|---|---|---|
| `id` | uuid | NOT NULL, DEFAULT `gen_random_uuid()` | **PK** |
| `admin_id` | uuid | NOT NULL | **FK** → `admins(id)` CASCADE |
| `staff_id` | uuid | nullable | **FK** → `staff(id)` **ON DELETE SET NULL** |
| `table_id` | uuid | nullable | **FK** → `tables(id)` **ON DELETE SET NULL** |
| `type` | `order_type` | NOT NULL | |
| `status` | `order_status` | NOT NULL, DEFAULT `'pending'` | |
| `total_amount` | numeric(10,2) | NOT NULL, DEFAULT `0` | **CHECK (`total_amount >= 0`)** |
| `notes` | text | nullable | |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` | |
| `completed_at` | timestamptz | nullable | |
| — | — | — | **CHECK `dine_in_requires_table`**: `type != 'dine-in' OR table_id IS NOT NULL` |

**`order_items`**
| Column | Type | Null / Default | Notes |
|---|---|---|---|
| `id` | uuid | NOT NULL, DEFAULT `gen_random_uuid()` | **PK** |
| `order_id` | uuid | NOT NULL | **FK** → `orders(id)` CASCADE |
| `product_id` | uuid | NOT NULL | **FK** → `products(id)` **ON DELETE RESTRICT** |
| `quantity` | integer | NOT NULL | **CHECK (`quantity > 0`)** |
| `unit_price` | numeric(10,2) | NOT NULL | **CHECK (`unit_price >= 0`)**; value comes from the **client** (§5) |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` | |

*No DB constraint enforces "an order has ≥ 1 item"; that rule is client/action-only.*

**`payments`**
| Column | Type | Null / Default | Notes |
|---|---|---|---|
| `id` | uuid | NOT NULL, DEFAULT `gen_random_uuid()` | **PK** |
| `order_id` | uuid | NOT NULL | **FK** → `orders(id)` CASCADE |
| `admin_id` | uuid | NOT NULL | **FK** → `admins(id)` CASCADE |
| `amount` | numeric(10,2) | NOT NULL | **CHECK (`amount >= 0`)** |
| `method` | `payment_method` | NOT NULL | |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` | |

**`kds_tickets`**
| Column | Type | Null / Default | Notes |
|---|---|---|---|
| `id` | uuid | NOT NULL, DEFAULT `gen_random_uuid()` | **PK** |
| `order_id` | uuid | NOT NULL | **FK** → `orders(id)` CASCADE |
| `admin_id` | uuid | NOT NULL | **FK** → `admins(id)` CASCADE |
| `status` | `kds_status` | NOT NULL, DEFAULT `'pending'` | |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT `now()` | maintained by trigger |

### 2.4 Indexes (migration 1)

Non-PK btree indexes on: `staff(admin_id)`, `shifts(admin_id)`, `shifts(staff_id)`, `tables(admin_id)`, `categories(admin_id)`, `products(admin_id)`, `products(category_id)`, `orders(admin_id)`, `orders(staff_id)`, `orders(table_id)`, `orders(status)`, `order_items(order_id)`, `payments(admin_id)`, `payments(order_id)`, `kds_tickets(admin_id)`, `kds_tickets(order_id)`.
No index on `order_items(product_id)` (used by `complete_order`'s join) or on `tables(row_position, column_position)`.

### 2.5 Functions / RPCs

| Function | Lang / flags | What it does | Called from |
|---|---|---|---|
| `get_my_admin_id() → uuid` | SQL, STABLE, SECURITY DEFINER | admin → `auth.uid()`; active staff → their `staff.admin_id`; else NULL. Tenant key + used in nearly every RLS policy. | `pos/page.tsx`, `pos/actions.ts`, `tables/page.tsx`, `tables/actions.ts`, `kds/page.tsx`, and all RLS |
| `is_admin() → boolean` | SQL, STABLE, SECURITY DEFINER | `EXISTS(admins WHERE id = auth.uid())` | **never called** (dead) |
| `set_updated_at() → trigger` | plpgsql | `NEW.updated_at = now()` | trigger below |
| `generate_business_code() → text` | plpgsql | loop: `upper(substring(md5(random()||clock_timestamp()) for 8))` until unique | column DEFAULT on `admins.business_code` |
| `register_staff(p_business_code, p_name, p_email) → void` | plpgsql, SECURITY DEFINER | resolves admin by code, inserts `staff` row `status='pending'`, `ON CONFLICT (id) DO NOTHING` | `auth/actions.ts` (`registerStaff`), `auth/callback/route.ts` |
| `business_code_exists(p_business_code) → boolean` | SQL, STABLE, SECURITY DEFINER | existence check without exposing `admins` rows to anon | `auth/actions.ts` (`registerStaff`) |
| `complete_order(p_order_id) → void` | plpgsql, SECURITY DEFINER | auth check → ownership check → completable-state check (`status IN ('pending','in-progress')`) → `IF EXISTS (stock < qty)` raise → `UPDATE products SET stock = stock - qty` → `orders` → `completed` → `kds_tickets` → `ready` | `kds/actions.ts` (`advanceTicket`, preparing→ready) |

### 2.6 Triggers

- `kds_tickets_set_updated_at` — `BEFORE UPDATE ON kds_tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at()`.
- That is the only trigger. (No trigger on `auth.users` to auto-provision `admins`/`staff` — provisioning is done in application code, `ensureAdminProfile` / `register_staff`.)

### 2.7 Views

**None.** `types.ts` declares `Views: { [_ in never]: never }`.

### 2.8 Row Level Security

**RLS is `ENABLE`d on all 10 tables** (`admins`, `staff`, `shifts`, `tables`, `categories`, `products`, `orders`, `order_items`, `payments`, `kds_tickets`). The anon REST probe (§3) returned `content-range: */0` for every table, consistent with RLS active and no anonymous visibility.

Policy definitions, verbatim from `20260331000000_initial_schema.sql`:

```sql
-- admins
CREATE POLICY "admins: read own row"   ON admins FOR SELECT USING (id = auth.uid());
CREATE POLICY "admins: insert own row" ON admins FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "admins: update own row" ON admins FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- (no DELETE policy on admins)

-- staff
CREATE POLICY "staff: read"         ON staff FOR SELECT USING (admin_id = auth.uid() OR id = auth.uid());
CREATE POLICY "staff: admin insert" ON staff FOR INSERT WITH CHECK (admin_id = auth.uid());
CREATE POLICY "staff: admin update" ON staff FOR UPDATE USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());
CREATE POLICY "staff: admin delete" ON staff FOR DELETE USING (admin_id = auth.uid());

-- shifts
CREATE POLICY "shifts: read scoped" ON shifts FOR SELECT USING (admin_id = get_my_admin_id());
CREATE POLICY "shifts: insert"      ON shifts FOR INSERT WITH CHECK (admin_id = get_my_admin_id());
CREATE POLICY "shifts: update"      ON shifts FOR UPDATE USING (admin_id = get_my_admin_id()) WITH CHECK (admin_id = get_my_admin_id());
-- (no DELETE policy on shifts)

-- tables
CREATE POLICY "tables: read scoped"   ON tables FOR SELECT USING (admin_id = get_my_admin_id());
CREATE POLICY "tables: admin insert"  ON tables FOR INSERT WITH CHECK (admin_id = auth.uid());
CREATE POLICY "tables: update scoped" ON tables FOR UPDATE USING (admin_id = get_my_admin_id()) WITH CHECK (admin_id = get_my_admin_id());
CREATE POLICY "tables: admin delete"  ON tables FOR DELETE USING (admin_id = auth.uid());

-- categories
CREATE POLICY "categories: read scoped"  ON categories FOR SELECT USING (admin_id = get_my_admin_id());
CREATE POLICY "categories: admin insert" ON categories FOR INSERT WITH CHECK (admin_id = auth.uid());
CREATE POLICY "categories: admin update" ON categories FOR UPDATE USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());
CREATE POLICY "categories: admin delete" ON categories FOR DELETE USING (admin_id = auth.uid());

-- products
CREATE POLICY "products: read scoped"  ON products FOR SELECT USING (admin_id = get_my_admin_id());
CREATE POLICY "products: admin insert" ON products FOR INSERT WITH CHECK (admin_id = auth.uid());
CREATE POLICY "products: admin update" ON products FOR UPDATE USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());
CREATE POLICY "products: admin delete" ON products FOR DELETE USING (admin_id = auth.uid());

-- orders
CREATE POLICY "orders: read scoped" ON orders FOR SELECT USING (admin_id = get_my_admin_id());
CREATE POLICY "orders: insert"      ON orders FOR INSERT WITH CHECK (admin_id = get_my_admin_id());
CREATE POLICY "orders: update"      ON orders FOR UPDATE USING (admin_id = get_my_admin_id()) WITH CHECK (admin_id = get_my_admin_id());
CREATE POLICY "orders: admin delete" ON orders FOR DELETE USING (admin_id = auth.uid());

-- order_items (scoped via parent order; no admin_id column)
CREATE POLICY "order_items: read scoped"  ON order_items FOR SELECT USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.admin_id = get_my_admin_id()));
CREATE POLICY "order_items: insert"       ON order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.admin_id = get_my_admin_id()));
CREATE POLICY "order_items: update"       ON order_items FOR UPDATE USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.admin_id = get_my_admin_id()));
CREATE POLICY "order_items: admin delete" ON order_items FOR DELETE USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.admin_id = auth.uid()));

-- payments
CREATE POLICY "payments: read scoped"  ON payments FOR SELECT USING (admin_id = get_my_admin_id());
CREATE POLICY "payments: insert"       ON payments FOR INSERT WITH CHECK (admin_id = get_my_admin_id());
CREATE POLICY "payments: admin delete" ON payments FOR DELETE USING (admin_id = auth.uid());
-- (no UPDATE policy on payments — intentionally immutable)

-- kds_tickets
CREATE POLICY "kds_tickets: read scoped"  ON kds_tickets FOR SELECT USING (admin_id = get_my_admin_id());
CREATE POLICY "kds_tickets: insert"       ON kds_tickets FOR INSERT WITH CHECK (admin_id = get_my_admin_id());
CREATE POLICY "kds_tickets: update"       ON kds_tickets FOR UPDATE USING (admin_id = get_my_admin_id()) WITH CHECK (admin_id = get_my_admin_id());
CREATE POLICY "kds_tickets: admin delete" ON kds_tickets FOR DELETE USING (admin_id = auth.uid());
```

RLS observations:
- `admins` has no DELETE policy and `shifts` has no DELETE policy → those deletes are blocked for everyone (fine, or an oversight for `shifts`).
- `staff` SELECT uses `admin_id = auth.uid()` (not `get_my_admin_id()`), so **one staff member cannot list co-workers** — only their own row. Intentional-looking.
- All INSERT/UPDATE/DELETE "admin" policies key on `auth.uid()` directly, so **active staff cannot create/edit products, categories, tables, or staff** even though they pass `get_my_admin_id()`. Correct per `CLAUDE.md`.
- `order_items` UPDATE policy has a `USING` clause but **no `WITH CHECK`** — an allowed row could in principle be updated to point at another order. No code does this, but the policy is asymmetric.

### 2.9 Realtime

Migration 1: `ALTER PUBLICATION supabase_realtime ADD TABLE tables;` and `… ADD TABLE kds_tickets;`.
`reset_schema.sql`: **these two lines are missing.** See §7 open question 1.

---

## 3. DATA (row counts, real vs seed vs empty)

**Could not be determined.** The only credential in the repo is `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a `sb_publishable_…` key). A REST probe of all 10 tables with that key returned **HTTP 200 + `content-range: */0`** for every table. Under the RLS policies above, the anon role sees zero rows regardless of whether the tables are empty or full, so this tells us only that RLS is on and the key is valid.

To get real counts you need the **service-role key** (not in the repo) or an authenticated admin session. As of this audit: **row counts unknown for every table; cannot classify any table as real / seed / empty.**

`CLAUDE.md` says "Do not generate placeholder or dummy data unless explicitly asked," and no seed SQL or `seed.sql` exists in `supabase/`, so if the DB is populated it was done by hand or through the running app.

---

## 4. FEATURES

Legend: **WORKING** = verified to run end to end. **PARTIAL** = code is present and the app builds/serves it, but the full path could not be exercised (needs a real Supabase user/session/DB rows) or has a known correctness gap. **STUBBED** = a route/handler exists but returns nothing real. **ABSENT** = not implemented at all.

Because no authenticated session could be established in this audit, **no feature that requires login is marked WORKING** — the honest ceiling is PARTIAL.

| Feature | Mark | Evidence |
|---|---|---|
| Auth / login (shared admin+staff email+password) | **PARTIAL** | `src/app/auth/actions.ts:20-108` (`login`); `src/app/login/page.tsx`; build+start verified, `GET /login` → 200, `GET /dashboard` (unauth) → 307 `/login`. Actual credentialed login not exercised. |
| Admin registration | **PARTIAL** | `src/app/auth/actions.ts:115-157`; `src/lib/supabase/admins.ts:56-135` (`ensureAdminProfile`). Email-confirmation branch (`!data.session`) depends on Supabase project settings (unknown). |
| Staff registration via business code | **PARTIAL** | `src/app/auth/actions.ts:165-233`; RPCs `register_staff` (mig 2), `business_code_exists` (mig 3); `src/app/register/page.tsx:152-228`. |
| Roles (admin vs staff vs pending/suspended) | **PARTIAL** | `middleware.ts:1-108`; `src/app/(admin)/layout.tsx`; `src/app/(staff)/layout.tsx:12-62`; `get_my_admin_id()`. Unauth redirect verified; role branching not exercised with real users. |
| Route protection | **PARTIAL** | `middleware.ts` (`ADMIN_ROUTES`, `STAFF_ROUTES`, `AUTH_ROUTES`) + redundant per-page `getUser()` checks + per-layout checks. Verified: unauth `/dashboard` → `/login`. |
| Staff management (approve / suspend / re-activate) | **PARTIAL** | `src/app/(admin)/staff/page.tsx`; `src/app/(admin)/staff/actions.ts:6-42`. Silently `return`s on any error (no feedback). |
| Business-code display + copy | **PARTIAL** | `src/app/(admin)/staff/page.tsx:123-145`; `src/components/CopyBusinessCodeButton.tsx` (uses `navigator.clipboard`). |
| Categories CRUD | **PARTIAL** | `src/app/(admin)/menu/actions.ts:41-121`; `src/app/(admin)/menu/categories/page.tsx`. Delete traps FK error `23503` with a friendly message. |
| Products CRUD | **PARTIAL** | `src/app/(admin)/menu/actions.ts:135-210`; `src/app/(admin)/menu/products/page.tsx`. `ensureCategoryBelongsToAdmin` re-checks category ownership. |
| Product availability toggle | **PARTIAL** | `src/app/(admin)/menu/actions.ts:249-267` (`toggleProductAvailability`), writes `is_available`. |
| Inventory / manual stock adjustment | **PARTIAL, UNSAFE** | `src/app/(admin)/menu/actions.ts:212-247` (`adjustProductStock`): read `stock` → `nextStock = stock + delta` in JS → `if (<0) reject` → `UPDATE`. Read-modify-write race, no lock/transaction (§5). |
| Stock "deployment / undeployment" | **ABSENT** | No such concept in schema or code. No location/warehouse/deploy tables. Closest thing is the `is_available` boolean. |
| POS menu (category grid → product grid, stock/availability filtered) | **PARTIAL** | `src/app/(staff)/pos/page.tsx:1-48` (server filters `is_available = true` AND `stock > 0`); `src/app/(staff)/pos/POSClient.tsx`. |
| POS cart | **PARTIAL** | `POSClient.tsx:79-129`. Quantity capped at `product.stock` **client-side only**. |
| Checkout / payment capture | **PARTIAL, gaps** | `src/app/(staff)/pos/actions.ts:19-143` (`submitOrder`). Creates `orders`(pending) → `order_items` → `kds_tickets`(pending) → `payments` → sets table `occupied`. **Trusts client `unitPrice` and `totalAmount`; performs no server-side stock check** (§5). No DB transaction — failures are compensated by flipping the order to `status='cancelled'`. |
| Order history + expandable detail | **PARTIAL** | `src/app/(staff)/orders/page.tsx` (serves `/orders` for both roles); `src/app/(admin)/orders/OrdersClient.tsx` (imported across the route group). Filters `status != 'cancelled'`, limit 200. |
| Order status lifecycle | **PARTIAL** | Only `pending` → `completed` (or `cancelled`) on `orders`. "preparing" lives on `kds_tickets.status`. `complete_order()` RPC (mig 1) does the transition. `in-progress` enum value unused. |
| Staff management shift history | **ABSENT** | `shifts` table exists; **no code references it at all** (§5). |
| KDS (realtime tickets, pending → preparing → ready) | **PARTIAL** | `src/app/(staff)/kds/page.tsx` (24h window); `src/app/(staff)/kds/actions.ts:8-54` (`advanceTicket`: pending→preparing = plain update; preparing→ready = `complete_order` RPC); `src/app/(staff)/kds/KDSClient.tsx:181-197` (realtime subscribe → `router.refresh()`). Realtime enablement on `kds_tickets` unverified (§7). |
| Tables floor view + status change + realtime | **PARTIAL** | `src/app/(staff)/tables/page.tsx`; `src/app/(staff)/tables/TablesClient.tsx:80-96` (realtime subscribe → `router.refresh()`); `src/app/(staff)/tables/actions.ts:8-34`. Cards are a plain responsive CSS grid in sort order — `row_position`/`column_position` are shown as "R# C#" labels but **not used for layout**. Realtime enablement unverified. |
| Table configuration (admin) | **PARTIAL** | `src/app/(admin)/tables/manage/page.tsx`; `src/app/(admin)/tables/manage/actions.ts` (create/update/delete). Not in the sidebar — reachable only via a button on `/tables`. |
| Payment methods (cash/card/grabpay/paynow/wechatpay) | **PARTIAL** | Enum (mig 1); selection in `POSClient.tsx:25-31`; one `payments` row per order in `submitOrder`; labels in `OrdersClient.tsx:52-58`. No split payment, no refund, no change calculation. |
| Dashboard | **PARTIAL** | `src/app/(admin)/dashboard/page.tsx`. Four `count` tiles (products, orders-today, staff, categories). "Orders today" boundary uses `new Date().toISOString().slice(0,10)` = **UTC midnight** — wrong for non-UTC businesses. No charts, no revenue, no AI digest. |
| Reporting (`/reports`) | **STUBBED** | `src/app/(admin)/reports/page.tsx` in full: `export default function ReportsPage() { return <div />; }`. Linked from the sidebar. No sales/product/payment/staff/peak-hour reports, no CSV export. |
| Settings (`/settings`) | **STUBBED** | `src/app/(admin)/settings/page.tsx` in full: `export default function SettingsPage() { return <div />; }`. No table config, **no OpenAI API-key input**, no general settings. |
| Stock movement history | **ABSENT** | No table, no log. `products.stock` is a bare integer; every change (RPC, admin adjust, admin overwrite) leaves no audit trail. |
| AI: Ask Your Data | **ABSENT** | No code, no route, no OpenAI dependency. |
| AI: Smart Restock Alerts | **ABSENT** | Same. |
| AI: Weekly Business Digest | **ABSENT** | Same. `admins.openai_api_key` column exists but is never read or written (`grep -ri openai src` → only `types.ts`). |

---

## 5. GAPS AND RISKS

### 5.1 Stock mutation audit (every place `products.stock` changes)

| # | Location | Protected by transaction? | Row lock? | DB function/RPC? | Anything at all? |
|---|---|---|---|---|---|
| 1 | `complete_order()` RPC — `UPDATE products SET stock = stock - oi.quantity FROM order_items oi …` (`20260331000000_initial_schema.sql`, function body ~L459-520) | **Yes** — plpgsql function body is one implicit transaction | **Implicit only** — the `UPDATE` takes a row lock; there is **no `SELECT … FOR UPDATE`**. The stock sufficiency check is a separate `IF EXISTS (SELECT … WHERE p.stock < oi.quantity)` that takes **no lock**. | Yes (this is the RPC) | Yes: `CHECK (stock >= 0)` on `products` is the real backstop |
| 2 | `adjustProductStock()` — admin "Adjust stock" button (`src/app/(admin)/menu/actions.ts:212-247`) | **No** | **No** | No | Only: JS reads `stock`, computes `stock + delta`, rejects if `< 0`, then `UPDATE`. Classic read-modify-write; concurrent adjustments **lose updates**. DB `CHECK` still prevents a negative landing. |
| 3 | `updateProduct()` — admin "Save changes" form (`src/app/(admin)/menu/actions.ts:172-210`) | **No** | **No** | No | Writes `stock` **directly from a form field** — blind overwrite that clobbers any concurrent change (including in-flight sales). Only the `CHECK` guards negatives. |
| 4 | `createProduct()` — initial stock from form (`src/app/(admin)/menu/actions.ts:135-170`) | n/a (insert) | n/a | No | Fine. |
| 5 | POS `submitOrder()` (`src/app/(staff)/pos/actions.ts:19-143`) | **No** (multi-statement action, no txn) | — | No | **Does not touch stock and does not check stock availability at all.** It trusts the client-filtered product list. |

**Can two simultaneous sales of the last unit both succeed?**

- **Through checkout + payment: YES.** `submitOrder` never reserves or checks stock. Any number of orders for the last unit can be created and **paid** concurrently. Stock is not held between checkout and kitchen completion.
- **Through to full completion (`complete_order` on "Mark Ready"): NO.** Two concurrent `complete_order` calls for the last unit: both pass the un-locked `IF EXISTS` stock check; the first `UPDATE` commits `stock = 0`; the second blocks on the row lock, then re-reads under READ COMMITTED and computes `0 - 1 = -1`, which **violates `CHECK (stock >= 0)`**, so that whole RPC raises and the KDS action returns `"Insufficient stock…"`.

**Net effect:** inventory is never oversold and `stock` can never go negative (the `CHECK` constraint holds). But the second order is **already paid**, and its failure at the KDS step leaves it stranded in `pending`/`preparing` with **no automatic cancel and no refund path** anywhere in the UI. The order-blocking rule from `CLAUDE.md` ("orders are blocked if requested qty exceeds available stock") is **not enforced at order time** — only at kitchen-ready time.

### 5.2 Other missing validation

- **Client-trusted pricing.** `submitOrder` inserts `order_items.unit_price` and `orders.total_amount` from the browser payload (`POSClient.tsx` sends `item.product.price` and a locally computed `cartTotal`). The server never re-reads `products.price` or recomputes the total. A crafted request can set any price/total ≥ 0.
- **No server-side "order has ≥ 1 item" DB constraint.** Enforced only in `submitOrder` (`if (!payload.items.length)`) and in `POSClient`.
- **Password confirmation is client-only** (`validatePasswords` in `src/app/register/page.tsx:80-84`). The server actions never compare `password`/`confirmPassword`. Minimum length is only the `minLength={8}` HTML attribute — no server check (Supabase's own policy is the only real gate).
- **`parseNumber` / `parseInteger` silently fall back to `0`** on unparneable input (`menu/actions.ts:35-39`, `tables/manage/actions.ts:34-38`) — a malformed price becomes `0.00`.
- **Staff status actions swallow errors** (`staff/actions.ts` — bare `return` on missing user/id; the `.update()` result is not checked). Admin sees no error if it fails.
- **Dashboard "orders today" uses UTC**, not the business's timezone.
- **`NEXT_PUBLIC_SITE_URL` is referenced but not set** (`.env.local` doesn't contain it). `auth/actions.ts` falls back to a hardcoded `http://localhost:3000` for `emailRedirectTo` in both `registerAdmin` and `registerStaff` — email confirmation links will point at localhost in any non-local deployment.

### 5.3 UI with no backend / backend with no UI

- **`/reports`** — sidebar link → empty `<div/>`.
- **`/settings`** — sidebar link → empty `<div/>`. This is where `CLAUDE.md` says the OpenAI API key is entered; there is no such input anywhere.
- **`admins.openai_api_key`** — column exists, never read or written.
- **`shifts` table** — full DDL, indexes, and 3 RLS policies; **zero code references**. No clock-in/out UI, no shift history (despite `CLAUDE.md` listing "shift history" under `/staff`).
- **`is_admin()` SQL function** — defined, never called.
- **`payments`** — no dedicated UI, but it is written (`submitOrder`) and read (order detail), so: partial, not orphaned.

### 5.4 Dead / duplicated / half-migrated

- **Empty leftover route dirs:** `src/app/kds/`, `src/app/pos/`, `src/app/tables/` (all empty, mtime 2026-04-01 14:29). The real pages live under `src/app/(staff)/`. Delete these.
- **`src/app/(admin)/orders/` has no `page.tsx`** — only `OrdersClient.tsx`. `/orders` is actually served by `src/app/(staff)/orders/page.tsx`, which imports `../../(admin)/orders/OrdersClient`. It works, but the folder is a misleading orphan and implies an admin `/orders` page was planned.
- **`supabase/reset_schema.sql`** diverges from the 4 migrations (adds `pgcrypto`; **drops the two realtime `ALTER PUBLICATION` lines**). Two sources of schema truth, not identical.
- **Two business-code generators:** `generate_business_code()` in SQL (the column default) **and** `generateBusinessCode()` in `src/lib/supabase/admins.ts:31-39` (JS, different alphabet incl. letters, 10-attempt retry). `ensureAdminProfile` passes an explicit JS-generated code on insert, bypassing the DB default.
- **Legacy-schema fallback code** in `src/lib/supabase/admins.ts` (`isSchemaFallbackCandidate`, the second `insert` without `name`/`business_code`, the second query in `getAdminProfile`). This exists to tolerate an **older `admins` table shape**. Either the live DB still has that shape (then the current code is fragile) or it doesn't (then this is dead defensive code). Evidence of at least one painful mid-project schema change.
- **`types.ts` is hand-authored** ("Hand-authored to match … Structured to exactly match the output of `supabase gen types typescript`"). It can silently drift from the real schema; it is not generated.
- **`.DS_Store` files** committed to the working tree in `supabase/`, `src/`, `src/app/`, `src/app/auth/` (they are in `.gitignore`, so harmless to git, but noise).

### 5.5 Version control

**Only `README.md` is committed.** `git ls-files` returns exactly one file. The entire application — all of `src/`, all migrations, all config, `package.json`, `package-lock.json` — is **untracked** (`git status` shows `??` for everything). There is no history, no baseline to diff against, and nothing is backed up in git. `commit 71f18c6` contains a one-line README and nothing else.

---

## 6. RUNNING IT

### Install / run commands
```bash
npm install          # see the repair note below — the committed node_modules was broken
npm run dev          # next dev  (http://localhost:3000)
npm run build        # next build
npm run start        # next start  (serves the production build)
npm run lint         # next lint
```
(`CLAUDE.md` also lists `supabase start` / `supabase db push`, but the Supabase CLI is **not installed** in this environment and there is no `supabase/config.toml`, so local Supabase is not set up.)

### Required environment variables
| Var | Where used | In `.env.local`? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `client.ts`, `server.ts`, `middleware.ts` | **Yes** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | **Yes** (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | `auth/actions.ts` (email redirect); falls back to `http://localhost:3000` | **No** (missing) |
| *(service-role key)* | — | **No** — not used anywhere; RLS-only design |
| *(OpenAI key)* | — | **No** — `CLAUDE.md` says per-admin DB column `admins.openai_api_key`, which is unused |

`.env.local` in full:
```
NEXT_PUBLIC_SUPABASE_URL=https://derxzbqvcbbnjobdqims.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_QNA6YXsG12pba4zZ7AQZTg_Q-IxOrIg
```

### Does it build and start? — what actually happened

1. **First `npm run build`: FAILED.**
   ```
   ⚠ Attempted to load @next/swc-darwin-arm64, but it was not installed
   ⨯ Failed to load SWC binary for darwin/arm64
   Error: Jest worker encountered 1 child process exceptions, exceeding retry limit
   ```
   Cause: `node_modules/@next/swc-darwin-arm64/` contained only `README.md` + `package.json` — the ~115 MB native binary `next-swc.darwin-arm64.node` was **missing**. The committed/installed `node_modules` was incomplete.

2. **`npm install` did NOT fix it** (npm believed the optional dep was already present). It was repaired by:
   ```bash
   rm -rf node_modules/@next/swc-darwin-arm64
   npm install @next/swc-darwin-arm64@14.2.15 --no-save
   ```
   After that the binary loaded (`node -e "require('@next/swc-darwin-arm64')"` → OK).

3. **Second `npm run build`: SUCCEEDED.**
   ```
   ✓ Compiled successfully
   ✓ Generating static pages (19/19)
   ```
   Routes built: `/` and `/login` and `/register` and `/_not-found` static; `/auth/callback` and `/dashboard` and `/kds` and `/menu` and `/menu/categories` and `/menu/products` and `/orders` and `/pos` and `/reports` and `/settings` and `/staff` and `/tables` and `/tables/manage` dynamic. One lint warning only (browserslist data age). No type errors.

4. **`npm run start`: SUCCEEDED.** `✓ Ready in 436ms`. Probes:
   - `GET /login` → **200**
   - `GET /` → **307** (redirect to `/login`)
   - `GET /dashboard` (unauthenticated) → **307 → `http://localhost:3000/dashboard` → /login`** (middleware protection works)

   Not exercised: any authenticated flow (needs a real Supabase user), Realtime, `complete_order`, email confirmation.

**Bottom line:** the app builds and serves **after** manually repairing the missing SWC native binary. As delivered (`node_modules` as found on disk), `next build` and `next dev` both fail immediately. A clean `rm -rf node_modules && npm install` on the target machine is the reliable fix and should be the documented first step.

---

## 7. OPEN QUESTIONS (need a human decision)

1. **Is Supabase Realtime enabled on `tables` and `kds_tickets` in the live project?** Migration 1 enables it; the newer `reset_schema.sql` (same date as `.env.local`) does not. If the DB was last built from `reset_schema.sql`, KDS and the floor plan get **no live updates** and there is no polling fallback — the "no polling" requirement silently fails. Confirm in the Supabase dashboard (Database → Replication) or re-run the `ALTER PUBLICATION` lines.
2. **Which schema is actually deployed** — the 4 incremental migrations, or `reset_schema.sql`? They are reconcilable but not identical. There is no `supabase/config.toml` and no access to `supabase_migrations.schema_migrations` to tell.
3. **Does the live `admins` table still have the pre-`business_code` shape** that `src/lib/supabase/admins.ts` has fallback code for? If not, that fallback path (and the second query in `getAdminProfile`) can be deleted.
4. **Is there real business data in any table?** Unverifiable with the anon key. Need the service-role key or an admin login to answer §3 at all.
5. **Was an admin `/orders` page intended?** `src/app/(admin)/orders/` holds only `OrdersClient.tsx`; the page is served cross-group from `(staff)/orders/`. Keep the cross-import, or add a real `(admin)/orders/page.tsx`?
6. **`order_status = 'in-progress'`** — dead enum value, or a planned state that should be wired up (e.g. when the kitchen starts preparing)?
7. **Is the app meant to stay uncommitted?** Right now nothing but `README.md` is in git. Confirm before any `git add -A` — and decide whether `.env.local` should really be committed (it currently is not, per `.gitignore`, but the anon key is low-sensitivity).
8. **AI scope.** `CLAUDE.md` describes three OpenAI features and a per-admin key. None exist. Still in scope, or cut?
9. **`shifts`** — build clock-in/out + shift history (referenced in `CLAUDE.md`), or drop the table?
10. **`/reports` and `/settings`** are shipped as empty `<div/>` but linked in the sidebar. Hide the links until built, or is someone mid-way through them?

---

## 8. RECOVERED DECISIONS (things a newcomer would not guess)

- **One `auth.users` row is either an admin or a staff member, decided by which table holds its `id`.** Both `admins.id` and `staff.id` are PKs that are also FKs to `auth.users(id)`. There is no `role` column on any app table; role is "does an `admins` row exist for this uid?" (`is_admin()` / the inline `.from("admins").select("id").eq("id", user.id)` checks) then "does a `staff` row exist?". `user_metadata.role` is set at signup but only used transiently to pick the post-confirmation branch.
- **`get_my_admin_id()` is the tenant key for everything.** Admin → own uid; **active** staff → their `admin_id`; pending/suspended/anon → NULL (which makes every RLS check fail closed). It is used both as the value inserted into `admin_id` columns by server actions and inside almost every RLS policy.
- **Staff onboarding is self-service + approval.** Staff register themselves with an 8-char `business_code` (shown on the admin's `/staff` page), are created as `status='pending'` by the SECURITY DEFINER `register_staff()` RPC, and are **immediately signed out**. They cannot log in until an admin sets them `active`. This is enforced in four independent places: the `login` action, `middleware.ts`, `(staff)/layout.tsx`, and `get_my_admin_id()`/RLS.
- **Order lifecycle: payment first, stock last.** `submitOrder` creates the order as `pending`, records the `payments` row up front, and creates the KDS ticket. Stock is **only** decremented later, when the kitchen moves the KDS ticket `preparing → ready`, which calls `complete_order()` — that RPC validates stock, decrements it, sets `orders.status='completed'`, and forces the KDS ticket to `ready` in one transaction. "preparing" is a `kds_tickets.status`, never an `orders.status`.
- **No DB transaction around checkout.** `submitOrder` runs 4–5 separate statements; on any failure it **flips the order to `status='cancelled'`** (it does not delete). So `orders` accumulates cancelled shells, and every list query filters `status != 'cancelled'`.
- **Nothing frees a table automatically.** A dine-in checkout sets the table `occupied`; it only returns to `available` when someone taps it on `/tables`. `complete_order` does not touch the table.
- **Two Supabase client factories on purpose:** `client.ts` (browser), `server.ts` (RSC/actions, cookie-bound), plus the `middleware.ts` helper. All three use the anon key; the design is deliberately service-role-free and leans entirely on RLS.
- **Realtime is "notify then refetch," not "apply the payload."** Both `TablesClient` and `KDSClient` subscribe to `postgres_changes` and, on any event, just call `router.refresh()` — the server component re-queries and passes fresh props. No client-side merge of realtime payloads.
- **Route protection is deliberately triple-layered.** `middleware.ts` does it centrally (as `CLAUDE.md` demands), but every page also re-checks `getUser()` + role, and every layout re-checks again.
- **`/tables/manage` is intentionally hidden from the sidebar** — only reachable via the `isAdmin`-gated "Configure tables" button on `/tables`.
- **The "floor plan" is not spatial.** `tables.shape` / `area_name` / `row_position` / `column_position` were added in migration 4, but `/tables` renders a plain responsive CSS grid ordered by `row_position, column_position, name`; shape only changes the card's border-radius; R/C are shown as text. No drag, no absolute positioning.
- **`admins.email` / `staff.email` are stored copies** of `auth.users.email`, written by the app at provision time (not synced by a trigger).

### Started and then abandoned (flag for the owner — you may not remember)

- `src/app/kds/`, `src/app/pos/`, `src/app/tables/` — created, then emptied when the `(staff)` route group was introduced. Still on disk, empty.
- `src/app/(admin)/orders/` — an admin Orders **page** was scaffolded far enough to build `OrdersClient.tsx`, then never finished; the staff page borrows the component.
- `supabase/reset_schema.sql` — a from-scratch schema bootstrap was hand-assembled on 2026-04-27 (likely to reset the Supabase project), and it **quietly dropped the Realtime publication statements**.
- The **legacy-`admins`-schema fallback** throughout `src/lib/supabase/admins.ts` — written to survive a schema migration that changed the `admins` table; now either load-bearing or dead, and nobody can tell which without looking at the live DB.
- `admins.openai_api_key` + the entire AI feature set from `CLAUDE.md` — the column was added, nothing was built on it.
- `shifts` — table + RLS + indexes created; no feature ever attached.
- `order_status = 'in-progress'` — reserved in the enum and tolerated by `complete_order`, never used.
