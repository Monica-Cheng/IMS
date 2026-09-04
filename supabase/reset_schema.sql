CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- StockBuddy POS — Full schema bootstrap for a brand new Supabase project
-- Safe use: run only on an empty database.
-- Source: combined from migrations in timestamp order.
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
CREATE TYPE table_shape    AS ENUM ('square', 'rectangle', 'round');

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE admins (
  id             UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT          NOT NULL,
  business_name  TEXT,
  openai_api_key TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  name           TEXT,
  business_code  TEXT UNIQUE,
  tax_rate       NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100)
);

CREATE TABLE staff (
  id         UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id   UUID         NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  name       TEXT         NOT NULL,
  email      TEXT         NOT NULL,
  status     staff_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE shifts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID        NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  staff_id   UUID        NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  clock_in   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tables (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID         NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  capacity        INTEGER,
  status          table_status NOT NULL DEFAULT 'available',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  shape           table_shape  NOT NULL DEFAULT 'square',
  area_name       TEXT,
  row_position    INTEGER      NOT NULL DEFAULT 0,
  column_position INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID        NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID           NOT NULL REFERENCES admins(id)      ON DELETE CASCADE,
  category_id  UUID           NOT NULL REFERENCES categories(id)  ON DELETE RESTRICT,
  name         TEXT           NOT NULL,
  description  TEXT,
  price        NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  cost_price   NUMERIC(10, 2) CHECK (cost_price >= 0),
  image_url    TEXT,
  stock        INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_available BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID           NOT NULL REFERENCES admins(id)  ON DELETE CASCADE,
  staff_id     UUID           REFERENCES staff(id)            ON DELETE SET NULL,
  table_id     UUID           REFERENCES tables(id)           ON DELETE SET NULL,
  type         order_type     NOT NULL,
  status       order_status   NOT NULL DEFAULT 'pending',
  subtotal     NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount   NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes        TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT dine_in_requires_table CHECK (type != 'dine-in' OR table_id IS NOT NULL)
);

CREATE TABLE order_items (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID           NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id UUID           NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity   INTEGER        NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  unit_cost  NUMERIC(10, 2) CHECK (unit_cost >= 0),
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID           NOT NULL REFERENCES orders(id)  ON DELETE CASCADE,
  admin_id   UUID           NOT NULL REFERENCES admins(id)  ON DELETE CASCADE,
  amount     NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  method     payment_method NOT NULL,
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

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
-- FUNCTIONS
-- =============================================================================

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
      WHERE id = auth.uid()
        AND status = 'active'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE id = auth.uid());
$$;

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

CREATE OR REPLACE FUNCTION generate_business_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM admins WHERE business_code = code);
  END LOOP;
  RETURN code;
END;
$$;

ALTER TABLE admins ALTER COLUMN business_code SET DEFAULT generate_business_code();

UPDATE admins
SET business_code = generate_business_code()
WHERE business_code IS NULL;

ALTER TABLE admins ALTER COLUMN business_code SET NOT NULL;

CREATE OR REPLACE FUNCTION register_staff(
  p_business_code TEXT,
  p_name          TEXT,
  p_email         TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_admin_id
  FROM admins
  WHERE business_code = upper(p_business_code);

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Invalid business code. Ask your manager for the correct code.';
  END IF;

  INSERT INTO staff (id, admin_id, name, email, status)
  VALUES (auth.uid(), v_admin_id, p_name, p_email, 'pending')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION business_code_exists(p_business_code TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admins
    WHERE business_code = upper(trim(p_business_code))
  );
$$;

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

  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = p_order_id AND admin_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = p_order_id AND status IN ('pending', 'in-progress')
  ) THEN
    RAISE EXCEPTION 'Order is not in a completable state';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND p.stock < oi.quantity
  ) THEN
    RAISE EXCEPTION 'Insufficient stock for one or more items';
  END IF;

  UPDATE products p
  SET stock = p.stock - oi.quantity
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND p.id = oi.product_id;

  UPDATE orders
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = p_order_id;

  UPDATE kds_tickets
  SET status = 'ready',
      updated_at = NOW()
  WHERE order_id = p_order_id;
END;
$$;

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

CREATE POLICY "admins: read own row"
  ON admins FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "admins: insert own row"
  ON admins FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "admins: update own row"
  ON admins FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "staff: read"
  ON staff FOR SELECT
  USING (admin_id = auth.uid() OR id = auth.uid());

CREATE POLICY "staff: admin insert"
  ON staff FOR INSERT
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "staff: admin update"
  ON staff FOR UPDATE
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "staff: admin delete"
  ON staff FOR DELETE
  USING (admin_id = auth.uid());

CREATE POLICY "shifts: read scoped"
  ON shifts FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "shifts: insert"
  ON shifts FOR INSERT
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "shifts: update"
  ON shifts FOR UPDATE
  USING (admin_id = get_my_admin_id())
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "tables: read scoped"
  ON tables FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "tables: admin insert"
  ON tables FOR INSERT
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "tables: update scoped"
  ON tables FOR UPDATE
  USING (admin_id = get_my_admin_id())
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "tables: admin delete"
  ON tables FOR DELETE
  USING (admin_id = auth.uid());

CREATE POLICY "categories: read scoped"
  ON categories FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "categories: admin insert"
  ON categories FOR INSERT
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "categories: admin update"
  ON categories FOR UPDATE
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "categories: admin delete"
  ON categories FOR DELETE
  USING (admin_id = auth.uid());

CREATE POLICY "products: read scoped"
  ON products FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "products: admin insert"
  ON products FOR INSERT
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "products: admin update"
  ON products FOR UPDATE
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "products: admin delete"
  ON products FOR DELETE
  USING (admin_id = auth.uid());

CREATE POLICY "orders: read scoped"
  ON orders FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "orders: insert"
  ON orders FOR INSERT
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "orders: update"
  ON orders FOR UPDATE
  USING (admin_id = get_my_admin_id())
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "orders: admin delete"
  ON orders FOR DELETE
  USING (admin_id = auth.uid());

CREATE POLICY "order_items: read scoped"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.admin_id = get_my_admin_id()
    )
  );

CREATE POLICY "order_items: insert"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.admin_id = get_my_admin_id()
    )
  );

CREATE POLICY "order_items: update"
  ON order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.admin_id = get_my_admin_id()
    )
  );

CREATE POLICY "order_items: admin delete"
  ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.admin_id = auth.uid()
    )
  );

CREATE POLICY "payments: read scoped"
  ON payments FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "payments: insert"
  ON payments FOR INSERT
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "payments: admin delete"
  ON payments FOR DELETE
  USING (admin_id = auth.uid());

CREATE POLICY "kds_tickets: read scoped"
  ON kds_tickets FOR SELECT
  USING (admin_id = get_my_admin_id());

CREATE POLICY "kds_tickets: insert"
  ON kds_tickets FOR INSERT
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "kds_tickets: update"
  ON kds_tickets FOR UPDATE
  USING (admin_id = get_my_admin_id())
  WITH CHECK (admin_id = get_my_admin_id());

CREATE POLICY "kds_tickets: admin delete"
  ON kds_tickets FOR DELETE
  USING (admin_id = auth.uid());
