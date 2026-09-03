-- =============================================================================
-- Add practical v1 table configuration fields
-- =============================================================================

CREATE TYPE table_shape AS ENUM ('square', 'rectangle', 'round');

ALTER TABLE tables
  ADD COLUMN shape table_shape NOT NULL DEFAULT 'square',
  ADD COLUMN area_name TEXT,
  ADD COLUMN row_position INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN column_position INTEGER NOT NULL DEFAULT 0;
