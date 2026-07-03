ALTER TABLE "onsite_event" ADD COLUMN IF NOT EXISTS "sale_id" uuid;

DO $$ BEGIN
  ALTER TABLE "onsite_event"
    ADD CONSTRAINT "onsite_event_sale_id_sale_id_fk"
    FOREIGN KEY ("sale_id") REFERENCES "sale"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "onsite_event_sale_id_idx" ON "onsite_event" ("sale_id");

-- Idempotent backfill: link lax001 gala to its matching saleroom sale when present.
UPDATE "onsite_event" oe
SET "sale_id" = (
  SELECT s.id
  FROM "sale" s
  WHERE s.deleted_at IS NULL
    AND s.delivery_mode IN ('onsite', 'hybrid')
    AND (
      s.title ILIKE '%LAX 001%'
      OR s.title ILIKE '%First Hammer%'
    )
  ORDER BY s.start_time DESC
  LIMIT 1
)
WHERE oe.slug = 'lax001'
  AND oe.sale_id IS NULL;
