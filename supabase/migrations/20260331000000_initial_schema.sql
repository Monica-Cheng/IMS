-- =============================================================================
-- StockBuddy POS — Initial Database Schema
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE staff_status   AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE table_status   AS ENUM ('available', 'occupied', 'reserved');
CREATE TYPE order_type     AS ENUM ('dine-in', 'takeaway');
CREATE TYPE order_status   AS ENUM ('pending', 'in-progress', 'completed', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'grabpay', 'paynow', 'wechatpay');
CREATE TYPE kds_status     AS ENUM ('pending', 'preparing', 'ready');

-- =============================================================================
-- TABLES
-- =============================================================================

-- admins: one row per business owner, linked 1-to-1 with auth.users
CREATE TABLE admins (
  id             UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  business_name  TEXT,
  openai_api_key TEXT,                    -- stored per admin; never exposed client-side
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- staff: cashiers / floor staff, each linked to auth.users and scoped to one admin
CREATE TABLE staff (
  id         UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id   UUID         NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  name       TEXT         NOT NULL,
  email      TEXT         NOT NULL,
  status     staff_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- shifts: clock-in / clock-out records
CREATE TABLE shifts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID        NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  staff_id   UUID        NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  clock_in   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- tables: dine-in floor plan
CREATE TABLE tables (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID         NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  name       TEXT         NOT NULL,
  capacity   INTEGER,
  status     table_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- categories: menu groupings, scoped per admin
CREATE TABLE categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID        NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- products: menu items with stock tracking
CREATE TABLE products (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID           NOT NULL REFERENCES admins(id)      ON DELETE CASCADE,
  category_id  UUID           NOT NULL REFERENCES categories(id)  ON DELETE RESTRICT,
  name         TEXT           NOT NULL,
  description  TEXT,
  price        NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  image_url    TEXT,
  stock        INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_available BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- orders: created by staff or admin
CREATE TABLE orders (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID           NOT NULL REFERENCES admins(id)  ON DELETE CASCADE,
  staff_id     UUID           REFERENCES staff(id)            ON DELETE SET NULL,
  table_id     UUID           REFERENCES tables(id)           ON DELETE SET NULL,
  type         order_type     NOT NULL,
  status       order_status   NOT NULL DEFAULT 'pending',
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes        TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT dine_in_requires_table CHECK (type != 'dine-in' OR table_id IS NOT NULL)
);

-- order_items: line items; price captured at time of order
CREATE TABLE order_items (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID           NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id UUID           NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity   INTEGER        NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- payments: one record per order payment
CREATE TABLE payments (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID           NOT NULL REFERENCES orders(id)  ON DELETE CASCADE,
  admin_id   UUID           NOT NULL REFERENCES admins(id)  ON DELETE CASCADE,
  amount     NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  method     payment_method NOT NULL,
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- kds_tickets: kitchen display cards, one per order
CREATE TABLE kds_tickets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  admin_id   UUID        NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  status     kds_status  NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX ON staff       (admin_id);
CREATE INDEX ON shifts      (admin_id);
CREATE INDEX ON shifts      (staff_id);
CREATE INDEX ON tables      (admin_id);
CREATE INDEX ON categories  (admin_id);
CREATE INDEX ON products    (admin_id);
CREATE INDEX ON products    (category_id);
CREATE INDEX ON orders      (admin_id);
CREATE INDEX ON orders      (staff_id);
CREATE INDEX ON orders      (table_id);
CREATE INDEX ON orders      (status);
CREATE INDEX ON order_items (order_id);
CREATE INDEX ON payments    (admin_id);
CREATE INDEX ON payments    (order_id);
CREATE INDEX ON kds_tickets (admin_id);
CREATE INDEX ON kds_tickets (order_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Returns the admin_id scoped to the calling user:
--   • If the caller IS an admin  → returns auth.uid()
--   • If the caller is active staff → returns their admin_id
--   • Otherwise (unauthenticated, pending/suspended staff) → returns NULL
-- SECURITY DEFINER so it can read admins/staff tables regardless of the
-- caller's RLS context.
CREATE OR REPLACE FUNCTION get_my_admin_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
      THEN auth.uid()
    ELSE (
      SELECT admin_id FROM staff
      WHERE  id = auth.uid()
        AND  status = 'active'
    )
  END;
$$;

-- Returns TRUE if the calling user is a registered admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE id = auth.uid());
$$;

-- Auto-update updated_at on kds_tickets
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER kds_tickets_set_updated_at
  BEFORE UPDATE ON kds_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE admins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kds_tickets ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- admins
-- ---------------------------------------------------------------------------

CREATE POLICY "admins: read own row"
  ON admins FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "admins: insert own row"
  ON admins FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "admins: update own row"
  ON admins FOR UPDATE
  USING    (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------

-- Admins see all staff in their org; staff see only their own row
CREATE POLICY "staff: read"
  ON staff FOR SELECT
  USING (admin_id = auth.uid() OR id = auth.uid());

-- Only admins can create staff records
CREATE POLICY "staff: admin insert"
  ON staff FOR INSERT
  WITH CHECK (admin_id = auth.uid());

-- Only admins can update staff (approve, suspend, etc.)
CREATE POLICY "staff: admin update"
  ON staff FOR UPDATE
  USING    (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "staff: admin delete"
  ON staff FOR DELETE
  USING (admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------

CREATE POLICY "shifts: read scoped"
  ON shifts FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "shifts: insert"
  ON shifts FOR INSERT
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "shifts: update"
  ON shifts FOR UPDATE
  USING    (admin_id = get_my_admin_id())
  WITH CHECK (admin_id = get_my_admin_id());

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------

-- All authenticated users in the org can read tables
CREATE POLICY "tables: read scoped"
  ON tables FOR SELECT
  USING (admin_id = get_my_admin_id());

-- Only admins manage table configuration
CREATE POLICY "tables: admin insert"
  ON tables FOR INSERT
  WITH CHECK (admin_id = auth.uid());

-- Staff can update status (available → occupied); admin controls everything
CREATE POLICY "tables: update scoped"
  ON tables FOR UPDATE
  USING    (admin_id = get_my_admin_id())
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "tables: admin delete"
  ON tables FOR DELETE
  USING (admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- categories (admin-managed only)
-- ---------------------------------------------------------------------------

CREATE POLICY "categories: read scoped"
  ON categories FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "categories: admin insert"
  ON categories FOR INSERT
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "categories: admin update"
  ON categories FOR UPDATE
  USING    (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "categories: admin delete"
  ON categories FOR DELETE
  USING (admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- products (admin-managed; staff read only)
-- ---------------------------------------------------------------------------

CREATE POLICY "products: read scoped"
  ON products FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "products: admin insert"
  ON products FOR INSERT
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "products: admin update"
  ON products FOR UPDATE
  USING    (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "products: admin delete"
  ON products FOR DELETE
  USING (admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- orders (staff + admin create; admin deletes)
-- ---------------------------------------------------------------------------

CREATE POLICY "orders: read scoped"
  ON orders FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "orders: insert"
  ON orders FOR INSERT
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "orders: update"
  ON orders FOR UPDATE
  USING    (admin_id = get_my_admin_id())
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "orders: admin delete"
  ON orders FOR DELETE
  USING (admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- order_items (scoped through parent order — no admin_id column)
-- ---------------------------------------------------------------------------

CREATE POLICY "order_items: read scoped"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE  orders.id       = order_items.order_id
        AND  orders.admin_id = get_my_admin_id()
    )
  );

CREATE POLICY "order_items: insert"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE  orders.id       = order_items.order_id
        AND  orders.admin_id = get_my_admin_id()
    )
  );

CREATE POLICY "order_items: update"
  ON order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE  orders.id       = order_items.order_id
        AND  orders.admin_id = get_my_admin_id()
    )
  );

CREATE POLICY "order_items: admin delete"
  ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE  orders.id       = order_items.order_id
        AND  orders.admin_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

CREATE POLICY "payments: read scoped"
  ON payments FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "payments: insert"
  ON payments FOR INSERT
  WITH CHECK (admin_id = get_my_admin_id());

-- Payments are immutable; only admins can delete
CREATE POLICY "payments: admin delete"
  ON payments FOR DELETE
  USING (admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- kds_tickets
-- ---------------------------------------------------------------------------

CREATE POLICY "kds_tickets: read scoped"
  ON kds_tickets FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "kds_tickets: insert"
  ON kds_tickets FOR INSERT
  WITH CHECK (admin_id = get_my_admin_id());

-- Staff and admin update KDS status (pending → preparing → ready)
CREATE POLICY "kds_tickets: update"
  ON kds_tickets FOR UPDATE
  USING    (admin_id = get_my_admin_id())
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "kds_tickets: admin delete"
  ON kds_tickets FOR DELETE
  USING (admin_id = auth.uid());

-- =============================================================================
-- RPC: complete_order — atomic stock decrement + order completion
--
-- Called server-side only (Next.js API route). Never called directly from the
-- browser client. Steps:
--   1. Verify caller has access to the order
--   2. Verify order is in a completable state
--   3. Verify sufficient stock for every line item
--   4. Decrement product stock atomically
--   5. Mark order as completed
--   6. Mark KDS ticket as ready
-- =============================================================================

CREATE OR REPLACE FUNCTION complete_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_my_admin_id();

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or insufficient permissions';
  END IF;

  -- Ownership check
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE  id = p_order_id AND admin_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  -- State check
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE  id = p_order_id AND status IN ('pending', 'in-progress')
  ) THEN
    RAISE EXCEPTION 'Order is not in a completable state';
  END IF;

  -- Stock check — fails the entire transaction if any item is short
  IF EXISTS (
    SELECT 1
    FROM   order_items oi
    JOIN   products    p  ON p.id = oi.product_id
    WHERE  oi.order_id = p_order_id
      AND  p.stock < oi.quantity
  ) THEN
    RAISE EXCEPTION 'Insufficient stock for one or more items';
  END IF;

  -- Decrement stock atomically
  UPDATE products p
  SET    stock = p.stock - oi.quantity
  FROM   order_items oi
  WHERE  oi.order_id = p_order_id
    AND  p.id = oi.product_id;

  -- Complete the order
  UPDATE orders
  SET    status       = 'completed',
         completed_at = NOW()
  WHERE  id = p_order_id;

  -- Advance KDS ticket
  UPDATE kds_tickets
  SET    status     = 'ready',
         updated_at = NOW()
  WHERE  order_id = p_order_id;
END;
$$;

-- =============================================================================
-- REALTIME
-- Only tables and kds_tickets require live Supabase Realtime subscriptions.
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE kds_tickets;
