ALTER TABLE bid ADD COLUMN IF NOT EXISTS internal_placement_key text;

CREATE UNIQUE INDEX IF NOT EXISTS bid_internal_placement_key_uniq
  ON bid (internal_placement_key)
  WHERE internal_placement_key IS NOT NULL;
