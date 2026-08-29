-- ============================================================================
-- CHAGEE QR Payload Crowdsourcing Database Schema
-- PostgreSQL (Supabase) - Singapore Focus
-- Schema: chagee
-- ============================================================================
-- Create the chagee schema
CREATE SCHEMA IF NOT EXISTS chagee;
-- ============================================================================
-- ENUM TYPES (in chagee schema)
-- ============================================================================
-- Review status for user contributions
CREATE TYPE chagee.contribution_status AS ENUM (
  'pending',
  -- Awaiting admin review
  'approved',
  -- Verified and published
  'rejected' -- Rejected by admin
);
-- Known sweetness levels (user-reported)
CREATE TYPE chagee.sweetness_level AS ENUM (
  'normal',
  -- Regular Sweet (100%)
  'less',
  -- Less Sweet (~70%)
  'slightly',
  -- Slightly Sweet (~30%)
  'none' -- No Additional Sugar (0%)
);
-- Known ice levels (user-reported)
CREATE TYPE chagee.ice_level AS ENUM (
  'normal',
  -- Normal Ice
  'less',
  -- Less Ice
  'none',
  -- No Ice
  'hot' -- Hot (ice level mapping unknown)
);
-- Known cup sizes
CREATE TYPE chagee.cup_size AS ENUM (
  'regular',
  -- A002
  'large' -- A001
);
-- SKU type categories based on prefix patterns
CREATE TYPE chagee.sku_type AS ENUM (
  'regular',
  -- SG#### - Regular menu items
  'limited',
  -- SGL#### - Seasonal/limited edition
  'cake',
  -- SGC#### - Cakes
  'special',
  -- SGSTC### - Special items (free milk, etc.)
  'bakery',
  -- Unknown format - bakery items
  'unknown' -- Unrecognized format
);
-- ============================================================================
-- REFERENCE TABLES
-- ============================================================================
-- SKU to Drink mapping (the primary research target)
CREATE TABLE chagee.drink_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code VARCHAR(20) UNIQUE NOT NULL,
  -- e.g., 'SG0422', 'SGL0001', 'SGSTC001'
  sku_type chagee.sku_type NOT NULL DEFAULT 'unknown',
  drink_name VARCHAR(200),
  -- e.g., 'Peach Oolong Milk Tea'
  drink_category VARCHAR(100),
  -- e.g., 'Milk Tea', 'Pure Tea', 'Snow Cap', 'Cake'
  has_milk BOOLEAN,
  -- Whether drink contains milk (NULL = unknown)
  uses_machine_milk BOOLEAN DEFAULT TRUE,
  -- FALSE for hand-poured milk (Snow Cap)
  is_verified BOOLEAN DEFAULT FALSE,
  -- Confirmed through multiple sources
  verification_count INT DEFAULT 0,
  -- Number of matching contributions
  calories_regular INT,
  -- Estimated calories (Regular size, Normal Sweet)
  calories_large INT,
  -- Estimated calories (Large size, Normal Sweet)
  notes TEXT,
  -- Admin notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Insert known SKUs from research
INSERT INTO chagee.drink_skus (
    sku_code,
    sku_type,
    drink_name,
    drink_category,
    has_milk,
    uses_machine_milk,
    is_verified
  )
VALUES -- Regular menu milk teas
  (
    'SG0101',
    'regular',
    'BO.YA Jasmine Milk Tea',
    'Milk Tea',
    TRUE,
    TRUE,
    TRUE
  ),
  (
    'SG0103',
    'regular',
    'Tie Guan Yin Milk Tea',
    'Milk Tea',
    TRUE,
    TRUE,
    TRUE
  ),
  (
    'SG0108',
    'regular',
    'Da Hong Pao Milk Tea',
    'Milk Tea',
    TRUE,
    TRUE,
    TRUE
  ),
  (
    'SG0422',
    'regular',
    'Peach Oolong Milk Tea',
    'Milk Tea',
    TRUE,
    TRUE,
    TRUE
  ),
  -- Regular menu pure teas
  (
    'SG0426',
    'regular',
    'Peach Oolong Tea',
    'Pure Tea',
    FALSE,
    FALSE,
    TRUE
  ),
  -- Snow Cap series (hand-poured milk, no C-value)
  (
    'SG0388',
    'regular',
    'Da Hong Pao Snow Cap Milk Tea',
    'Snow Cap',
    TRUE,
    FALSE,
    TRUE
  ),
  -- Special items
  (
    'SGSTC001',
    'special',
    'Free Milk',
    'Special',
    TRUE,
    TRUE,
    TRUE
  );
-- Cup size mappings (A-values)
CREATE TABLE chagee.cup_size_codes (
  code VARCHAR(10) PRIMARY KEY,
  -- e.g., 'A001', 'A002'
  size chagee.cup_size NOT NULL,
  description VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO chagee.cup_size_codes (code, size, description)
VALUES ('A001', 'large', 'Large Size'),
  ('A002', 'regular', 'Regular Size');
-- Milk type mappings (C-values)
CREATE TABLE chagee.milk_codes (
  code VARCHAR(10) PRIMARY KEY,
  -- e.g., 'C001', 'C002', 'C003'
  milk_name VARCHAR(100) NOT NULL,
  description VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO chagee.milk_codes (code, milk_name, description)
VALUES (
    'C001',
    'Regular Fresh Milk',
    'Standard fresh milk option'
  ),
  (
    'C002',
    'Oat Milk',
    'Plant-based oat milk alternative'
  ),
  (
    'C003',
    'Non-Fat Milk',
    'Skim/non-fat milk option'
  );
-- Ice level mappings (m-values) - Water offset
CREATE TABLE chagee.ice_codes (
  code VARCHAR(10) PRIMARY KEY,
  -- e.g., 'm001', 'm002', 'm003'
  ice_level chagee.ice_level NOT NULL,
  description VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO chagee.ice_codes (code, ice_level, description)
VALUES ('m001', 'normal', 'Normal Ice'),
  (
    'm002',
    'less',
    'Less Ice (water offset applied)'
  ),
  ('m003', 'none', 'No Ice (maximum water offset)');
-- Sweetness preset mappings (mm-values)
-- NOTE: These do NOT directly map to user-selected sweetness levels!
-- The actual sweetness depends on the drink's base astringency.
CREATE TABLE chagee.sweetness_codes (
  code VARCHAR(10) PRIMARY KEY,
  -- e.g., 'mm001', 'mm002', 'mm003'
  preset_number INT NOT NULL,
  -- Numeric extraction for sorting
  description VARCHAR(200),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INT DEFAULT 0 -- How many times we've seen this code
);
INSERT INTO chagee.sweetness_codes (code, preset_number, description)
VALUES (
    'mm001',
    1,
    'Sweetness preset 1 (varies by drink)'
  ),
  (
    'mm002',
    2,
    'Sweetness preset 2 (varies by drink)'
  ),
  (
    'mm003',
    3,
    'Sweetness preset 3 (varies by drink)'
  );
-- ============================================================================
-- USER CONTRIBUTIONS
-- ============================================================================
-- Main contributions table
CREATE TABLE chagee.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Raw QR payload data
  raw_payload TEXT NOT NULL,
  -- Original scanned QR code content
  -- Parsed QR segments
  t_value VARCHAR(20) NOT NULL,
  -- Transaction number (e.g., 'T0241')
  sku_value VARCHAR(20) NOT NULL,
  -- SKU code (e.g., 'SG0422', 'SGSTC001')
  sku_type chagee.sku_type NOT NULL,
  -- Categorized SKU type
  segment_3_raw TEXT NOT NULL,
  -- Raw third segment for debugging
  -- Parsed segment 3 fragments (nullable - may be omitted)
  a_value VARCHAR(10),
  -- Cup size code (may be NULL for special items)
  c_value VARCHAR(10),
  -- Milk code (NULL for no-milk or hand-poured)
  m_value VARCHAR(10),
  -- Ice code
  mm_value VARCHAR(10),
  -- Sweetness code (NULL for no sugar)
  -- User-reported drink details
  reported_drink_name VARCHAR(200) NOT NULL,
  reported_size chagee.cup_size,
  -- NULL for items without size option
  reported_sweetness chagee.sweetness_level,
  -- NULL for items without sweetness option
  reported_ice chagee.ice_level NOT NULL,
  reported_milk_type VARCHAR(100),
  -- User's description of milk choice
  -- Image evidence
  image_storage_path TEXT,
  -- Path in Supabase Storage
  image_url TEXT,
  -- Public/signed URL for display
  -- Submission metadata
  submitter_ip_hash VARCHAR(64),
  -- Hashed IP for rate limiting/abuse detection
  user_agent TEXT,
  -- Browser/device info
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  -- Review workflow
  status chagee.contribution_status DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  -- Admin identifier
  review_notes TEXT,
  -- Review flags (set by system, reviewed by admin)
  flag_new_sku BOOLEAN DEFAULT FALSE,
  -- SKU not in drink_skus table
  flag_new_codes BOOLEAN DEFAULT FALSE,
  -- Contains unknown A/C/m/mm codes
  flag_size_mismatch BOOLEAN DEFAULT FALSE,
  -- Reported size vs QR A-value mismatch
  flag_missing_expected_milk BOOLEAN DEFAULT FALSE,
  -- Machine-milk drink missing C-value
  flag_unexpected_milk BOOLEAN DEFAULT FALSE,
  -- Non-milk drink has C-value
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- ============================================================================
-- SWEETNESS ANALYSIS (for cracking the formula)
-- ============================================================================
-- Track SKU + Sweetness correlations
-- This helps crack the mm-value mystery by seeing which presets appear for
-- which drinks at which user-selected sweetness levels
CREATE TABLE chagee.sweetness_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID NOT NULL REFERENCES chagee.contributions(id) ON DELETE CASCADE,
  sku_code VARCHAR(20) NOT NULL,
  drink_name VARCHAR(200),
  cup_size chagee.cup_size,
  -- The mapping we're trying to crack
  mm_code VARCHAR(10),
  -- The QR mm-value (or NULL if omitted)
  reported_sweetness chagee.sweetness_level,
  -- What user selected
  -- For analysis
  mm_was_omitted BOOLEAN NOT NULL,
  -- TRUE if no mm-value in QR
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contribution_id)
);
-- ============================================================================
-- INDEXES
-- ============================================================================
-- Contributions indexes
CREATE INDEX idx_contributions_status ON chagee.contributions(status);
CREATE INDEX idx_contributions_sku ON chagee.contributions(sku_value);
CREATE INDEX idx_contributions_sku_type ON chagee.contributions(sku_type);
CREATE INDEX idx_contributions_approved ON chagee.contributions(status)
WHERE status = 'approved';
CREATE INDEX idx_contributions_submitted_at ON chagee.contributions(submitted_at DESC);
CREATE INDEX idx_contributions_pending_flags ON chagee.contributions(status, flag_new_sku, flag_size_mismatch)
WHERE status = 'pending';
-- Sweetness observations for analysis
CREATE INDEX idx_sweetness_obs_sku ON chagee.sweetness_observations(sku_code);
CREATE INDEX idx_sweetness_obs_mm ON chagee.sweetness_observations(mm_code);
-- SKU lookups
CREATE INDEX idx_drink_skus_type ON chagee.drink_skus(sku_type);
CREATE INDEX idx_drink_skus_verified ON chagee.drink_skus(is_verified)
WHERE is_verified = TRUE;
-- ============================================================================
-- FUNCTIONS
-- ============================================================================
-- Function to determine SKU type from SKU code
CREATE OR REPLACE FUNCTION chagee.get_sku_type(sku_code VARCHAR) RETURNS chagee.sku_type AS $$ BEGIN -- Check patterns in order of specificity
  IF sku_code ~ '^SG[0-9]{4}$' THEN RETURN 'regular';
ELSIF sku_code ~ '^SGL[0-9]{4}$' THEN RETURN 'limited';
ELSIF sku_code ~ '^SGC[0-9]{4}$' THEN RETURN 'cake';
ELSIF sku_code ~ '^SGSTC[0-9]+$' THEN RETURN 'special';
ELSIF sku_code ~ '^SG' THEN -- Singapore but unknown format - could be bakery or new category
RETURN 'unknown';
ELSE RETURN 'unknown';
END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
-- Function to set review flags on a contribution
CREATE OR REPLACE FUNCTION chagee.set_contribution_flags(contrib_id UUID) RETURNS VOID AS $$
DECLARE contrib RECORD;
drink RECORD;
v_flag_new_sku BOOLEAN := FALSE;
v_flag_new_codes BOOLEAN := FALSE;
v_flag_size_mismatch BOOLEAN := FALSE;
v_flag_missing_expected_milk BOOLEAN := FALSE;
v_flag_unexpected_milk BOOLEAN := FALSE;
BEGIN
SELECT * INTO contrib
FROM chagee.contributions
WHERE id = contrib_id;
IF NOT FOUND THEN RETURN;
END IF;
-- Flag 1: New SKU
SELECT * INTO drink
FROM chagee.drink_skus
WHERE sku_code = contrib.sku_value;
IF NOT FOUND THEN v_flag_new_sku := TRUE;
END IF;
-- Flag 2: Unknown codes (A, C, m, mm)
IF contrib.a_value IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM chagee.cup_size_codes
  WHERE code = contrib.a_value
) THEN v_flag_new_codes := TRUE;
END IF;
IF contrib.c_value IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM chagee.milk_codes
  WHERE code = contrib.c_value
) THEN v_flag_new_codes := TRUE;
END IF;
IF contrib.m_value IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM chagee.ice_codes
  WHERE code = contrib.m_value
) THEN v_flag_new_codes := TRUE;
END IF;
IF contrib.mm_value IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM chagee.sweetness_codes
  WHERE code = contrib.mm_value
) THEN v_flag_new_codes := TRUE;
-- Auto-insert new sweetness code for tracking
INSERT INTO chagee.sweetness_codes (code, preset_number, description, first_seen_at)
VALUES (
    contrib.mm_value,
    CAST(
      substring(
        contrib.mm_value
        FROM 3
      ) AS INT
    ),
    'Auto-discovered sweetness preset',
    NOW()
  ) ON CONFLICT (code) DO
UPDATE
SET occurrence_count = chagee.sweetness_codes.occurrence_count + 1;
ELSE -- Update occurrence count for known codes
UPDATE chagee.sweetness_codes
SET occurrence_count = occurrence_count + 1
WHERE code = contrib.mm_value;
END IF;
-- Flag 3: Size mismatch (only if both values exist)
IF contrib.a_value IS NOT NULL
AND contrib.reported_size IS NOT NULL THEN IF (
  contrib.a_value = 'A001'
  AND contrib.reported_size = 'regular'
)
OR (
  contrib.a_value = 'A002'
  AND contrib.reported_size = 'large'
  ) THEN v_flag_size_mismatch := TRUE;
END IF;
END IF;
-- Flag 4: Missing expected milk (only for known machine-milk drinks)
IF drink.uses_machine_milk = TRUE
AND contrib.c_value IS NULL THEN v_flag_missing_expected_milk := TRUE;
END IF;
-- Flag 5: Unexpected milk (only for known no-milk drinks)
IF drink.has_milk = FALSE
AND contrib.c_value IS NOT NULL THEN v_flag_unexpected_milk := TRUE;
END IF;
-- Update the contribution
UPDATE chagee.contributions
SET flag_new_sku = v_flag_new_sku,
  flag_new_codes = v_flag_new_codes,
  flag_size_mismatch = v_flag_size_mismatch,
  flag_missing_expected_milk = v_flag_missing_expected_milk,
  flag_unexpected_milk = v_flag_unexpected_milk
WHERE id = contrib_id;
END;
$$ LANGUAGE plpgsql;
-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION chagee.update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_contributions_updated_at BEFORE
UPDATE ON chagee.contributions FOR EACH ROW EXECUTE FUNCTION chagee.update_updated_at();
CREATE TRIGGER trigger_drink_skus_updated_at BEFORE
UPDATE ON chagee.drink_skus FOR EACH ROW EXECUTE FUNCTION chagee.update_updated_at();
-- Auto-set flags and create sweetness observation on new contribution
CREATE OR REPLACE FUNCTION chagee.trigger_on_contribution_insert() RETURNS TRIGGER AS $$ BEGIN -- Set review flags
  PERFORM chagee.set_contribution_flags(NEW.id);
-- Create sweetness observation for analysis (only if sweetness is reported)
IF NEW.reported_sweetness IS NOT NULL THEN
INSERT INTO chagee.sweetness_observations (
    contribution_id,
    sku_code,
    drink_name,
    cup_size,
    mm_code,
    reported_sweetness,
    mm_was_omitted
  )
VALUES (
    NEW.id,
    NEW.sku_value,
    NEW.reported_drink_name,
    NEW.reported_size,
    NEW.mm_value,
    NEW.reported_sweetness,
    (NEW.mm_value IS NULL)
  );
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_contribution_on_insert
AFTER
INSERT ON chagee.contributions FOR EACH ROW EXECUTE FUNCTION chagee.trigger_on_contribution_insert();
-- Auto-update SKU verification count when contribution is approved
CREATE OR REPLACE FUNCTION chagee.trigger_on_contribution_approved() RETURNS TRIGGER AS $$ BEGIN IF NEW.status = 'approved'
  AND (
    OLD.status IS NULL
    OR OLD.status != 'approved'
  ) THEN -- Update existing SKU verification count
UPDATE chagee.drink_skus
SET verification_count = verification_count + 1,
  is_verified = TRUE
WHERE sku_code = NEW.sku_value;
-- If this is a new SKU, insert it
INSERT INTO chagee.drink_skus (
    sku_code,
    sku_type,
    drink_name,
    drink_category,
    has_milk,
    uses_machine_milk,
    is_verified,
    verification_count
  )
VALUES (
    NEW.sku_value,
    NEW.sku_type,
    NEW.reported_drink_name,
    CASE
      WHEN NEW.sku_type = 'cake' THEN 'Cake'
      WHEN NEW.sku_type = 'special' THEN 'Special'
      WHEN NEW.c_value IS NOT NULL THEN 'Milk Tea'
      ELSE 'Pure Tea'
    END,
    NEW.c_value IS NOT NULL
    OR NEW.sku_type = 'special',
    NEW.c_value IS NOT NULL,
    TRUE,
    1
  ) ON CONFLICT (sku_code) DO NOTHING;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_contribution_approved
AFTER
UPDATE ON chagee.contributions FOR EACH ROW EXECUTE FUNCTION chagee.trigger_on_contribution_approved();
-- ============================================================================
-- VIEWS
-- ============================================================================
-- Public view of approved Singapore drinks
CREATE VIEW chagee.public_drinks AS
SELECT d.sku_code,
  d.sku_type,
  d.drink_name,
  d.drink_category,
  d.has_milk,
  d.uses_machine_milk,
  d.calories_regular,
  d.calories_large,
  d.verification_count,
  d.is_verified
FROM chagee.drink_skus d
WHERE d.is_verified = TRUE
ORDER BY d.sku_type,
  d.drink_category,
  d.drink_name;
-- Admin view: Pending contributions with flags
CREATE VIEW chagee.admin_pending_contributions AS
SELECT c.id,
  c.raw_payload,
  c.t_value,
  c.sku_value,
  c.sku_type,
  c.segment_3_raw,
  c.a_value,
  c.c_value,
  c.m_value,
  c.mm_value,
  c.reported_drink_name,
  c.reported_size,
  c.reported_sweetness,
  c.reported_ice,
  c.reported_milk_type,
  c.image_url,
  c.submitted_at,
  -- Flags for review UI
  c.flag_new_sku,
  c.flag_new_codes,
  c.flag_size_mismatch,
  c.flag_missing_expected_milk,
  c.flag_unexpected_milk,
  -- Check if ANY flag is set
  (
    c.flag_new_sku
    OR c.flag_new_codes
    OR c.flag_size_mismatch
    OR c.flag_missing_expected_milk
    OR c.flag_unexpected_milk
  ) AS has_flags,
  -- Existing SKU info (if any)
  d.drink_name AS known_drink_name,
  d.drink_category AS known_category,
  d.uses_machine_milk AS known_uses_machine_milk
FROM chagee.contributions c
  LEFT JOIN chagee.drink_skus d ON d.sku_code = c.sku_value
WHERE c.status = 'pending'
ORDER BY (
    c.flag_new_sku
    OR c.flag_new_codes
    OR c.flag_size_mismatch
    OR c.flag_missing_expected_milk
    OR c.flag_unexpected_milk
  ) DESC,
  c.submitted_at ASC;
-- Sweetness mapping analysis view
CREATE VIEW chagee.sweetness_analysis AS
SELECT so.sku_code,
  d.drink_name,
  d.drink_category,
  so.cup_size,
  so.reported_sweetness,
  so.mm_code,
  so.mm_was_omitted,
  COUNT(*) AS observation_count
FROM chagee.sweetness_observations so
  JOIN chagee.contributions c ON c.id = so.contribution_id
  LEFT JOIN chagee.drink_skus d ON d.sku_code = so.sku_code
WHERE c.status = 'approved'
GROUP BY so.sku_code,
  d.drink_name,
  d.drink_category,
  so.cup_size,
  so.reported_sweetness,
  so.mm_code,
  so.mm_was_omitted
ORDER BY so.sku_code,
  so.cup_size,
  so.reported_sweetness;
-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE chagee.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chagee.sweetness_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chagee.drink_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE chagee.cup_size_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chagee.milk_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chagee.ice_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chagee.sweetness_codes ENABLE ROW LEVEL SECURITY;
-- Public read access to reference tables
CREATE POLICY "Public read access to drink_skus" ON chagee.drink_skus FOR
SELECT USING (true);
CREATE POLICY "Public read access to cup_size_codes" ON chagee.cup_size_codes FOR
SELECT USING (true);
CREATE POLICY "Public read access to milk_codes" ON chagee.milk_codes FOR
SELECT USING (true);
CREATE POLICY "Public read access to ice_codes" ON chagee.ice_codes FOR
SELECT USING (true);
CREATE POLICY "Public read access to sweetness_codes" ON chagee.sweetness_codes FOR
SELECT USING (true);
-- Anyone can insert contributions
CREATE POLICY "Anyone can submit contributions" ON chagee.contributions FOR
INSERT WITH CHECK (true);
-- Only approved contributions are publicly readable
CREATE POLICY "Public read approved contributions" ON chagee.contributions FOR
SELECT USING (status = 'approved');
-- Admin policies (requires auth.jwt() role = 'admin')
CREATE POLICY "Admin full access to contributions" ON chagee.contributions FOR ALL USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Admin full access to sweetness_observations" ON chagee.sweetness_observations FOR ALL USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Admin can modify drink_skus" ON chagee.drink_skus FOR ALL USING (auth.jwt()->>'role' = 'admin');
-- ============================================================================
-- GRANT PERMISSIONS (for Supabase anon/authenticated roles)
-- ============================================================================
-- Grant usage on schema
GRANT USAGE ON SCHEMA chagee TO anon,
  authenticated,
  service_role;
-- Grant select on all tables to anon (RLS will filter)
GRANT SELECT ON ALL TABLES IN SCHEMA chagee TO anon,
  authenticated,
  service_role;
-- Grant insert on contributions to anon (for public form)
GRANT INSERT ON chagee.contributions TO anon,
  authenticated;
-- Grant all to authenticated (admin will be further filtered by RLS)
GRANT ALL ON ALL TABLES IN SCHEMA chagee TO authenticated,
  service_role;
GRANT USAGE,
  SELECT ON ALL SEQUENCES IN SCHEMA chagee TO anon,
  authenticated,
  service_role;