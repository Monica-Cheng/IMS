-- =============================================================================
-- Validate business codes for public staff signup without exposing admins rows
-- =============================================================================

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
