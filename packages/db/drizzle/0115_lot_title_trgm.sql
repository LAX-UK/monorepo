-- Trigram index for catalogue title search (`ilike '%term%'`).
-- Requires min 3-char queries at the API layer.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "lot_title_trgm_idx"
  ON "lot" USING gin (lower("title") gin_trgm_ops);
