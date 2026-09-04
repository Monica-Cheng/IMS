-- =============================================================================
-- Add cost tracking + tax
--
--   products.cost_price    — what the admin pays their supplier per unit.
--                            NULL because existing products have no recorded cost.
--   order_items.unit_cost  — snapshot of the product's cost_price at sale time.
--                            NULL for historical rows and until POS is wired up.
--   admins.tax_rate        — tax percentage applied at checkout (e.g. 9.00 = 9%).
--   orders.subtotal        — pre-tax total.
--   orders.tax_amount      — tax portion of the order.
--
-- orders.total_amount is left as the gross (subtotal + tax) total.
-- No RLS changes: every column here is on a table that already has policies.
-- =============================================================================

ALTER TABLE products
  ADD COLUMN cost_price NUMERIC(10, 2) CHECK (cost_price >= 0);

ALTER TABLE order_items
  ADD COLUMN unit_cost NUMERIC(10, 2) CHECK (unit_cost >= 0);

ALTER TABLE admins
  ADD COLUMN tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (tax_rate >= 0 AND tax_rate <= 100);

ALTER TABLE orders
  ADD COLUMN subtotal   NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  ADD COLUMN tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0);
