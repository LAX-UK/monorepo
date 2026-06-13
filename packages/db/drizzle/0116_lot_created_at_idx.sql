-- Index for admin KPI trend query (lots created per day).
-- Supports: SELECT date_trunc('day', created_at), count(*) FROM lot WHERE created_at > $1 AND deleted_at IS NULL GROUP BY 1
-- Max query range: 180 days (90 current + 90 prior window).

CREATE INDEX IF NOT EXISTS "lot_created_at_not_deleted_idx"
  ON "lot" ("created_at")
  WHERE "deleted_at" IS NULL;
