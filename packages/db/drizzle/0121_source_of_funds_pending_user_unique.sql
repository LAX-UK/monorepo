-- Collapse duplicate pending Source-of-Funds cases per buyer (keep the oldest
-- pending row so staff triage order matches queue intent) so the partial unique
-- index can be created cleanly.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM source_of_funds
  WHERE status = 'pending'
),
removed AS (
  DELETE FROM source_of_funds sof
  USING ranked r
  WHERE sof.id = r.id AND r.rn > 1
  RETURNING sof.id
)
DELETE FROM admin_review_task art
WHERE art.kind = 'source_of_funds_review'
  AND art.status IN ('pending', 'in_progress')
  AND art.payload ->> 'sourceOfFundsId' IN (SELECT id::text FROM removed);
--> statement-breakpoint
-- Hard concurrency guard: at most one pending SoF case per buyer.
CREATE UNIQUE INDEX IF NOT EXISTS "source_of_funds_pending_user_uidx"
  ON "source_of_funds" ("user_id")
  WHERE "status" = 'pending';
