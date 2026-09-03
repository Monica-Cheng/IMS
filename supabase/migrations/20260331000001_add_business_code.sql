-- =============================================================================
-- Add name + business_code to admins; add register_staff RPC
-- =============================================================================

-- Admin's personal name (distinct from business_name)
ALTER TABLE admins ADD COLUMN name TEXT;

-- Unique 8-char uppercase code admins share with their staff
ALTER TABLE admins ADD COLUMN business_code TEXT UNIQUE;

-- Generator: collision-safe random 8-char hex code
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

-- Apply as the column default so every new admin row gets one automatically
ALTER TABLE admins ALTER COLUMN business_code SET DEFAULT generate_business_code();

-- Backfill any existing rows that don't have a code yet
UPDATE admins SET business_code = generate_business_code() WHERE business_code IS NULL;

-- Now enforce NOT NULL
ALTER TABLE admins ALTER COLUMN business_code SET NOT NULL;

-- =============================================================================
-- RPC: register_staff
--
-- Creates a staff row for the currently authenticated user, linked to the admin
-- identified by p_business_code.  Must be called immediately after signUp when
-- a session is available.  SECURITY DEFINER so it can bypass the staff INSERT
-- RLS policy (which requires admin_id = auth.uid()).
-- =============================================================================
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
  FROM   admins
  WHERE  business_code = upper(p_business_code);

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Invalid business code. Ask your manager for the correct code.';
  END IF;

  INSERT INTO staff (id, admin_id, name, email, status)
  VALUES (auth.uid(), v_admin_id, p_name, p_email, 'pending')
  ON CONFLICT (id) DO NOTHING;
END;
$$;
