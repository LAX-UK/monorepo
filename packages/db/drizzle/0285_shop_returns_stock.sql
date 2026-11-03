-- Returns record what staff decided when an item came back, and a failed refund records that
-- finance settled it outside LAX. All columns are nullable, so the previous release is unaffected.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE shop_return ADD COLUMN IF NOT EXISTS disposition text;
--> statement-breakpoint
UPDATE shop_return SET disposition = 'back_on_sale' WHERE status = 'received' AND disposition IS NULL;
--> statement-breakpoint
ALTER TABLE shop_return DROP CONSTRAINT IF EXISTS shop_return_disposition_ck;
--> statement-breakpoint
ALTER TABLE shop_return
  ADD CONSTRAINT shop_return_disposition_ck CHECK (
    (disposition IS NULL OR disposition IN ('back_on_sale', 'withdrawn_damaged'))
    AND ((status = 'received') = (disposition IS NOT NULL))
  );
--> statement-breakpoint
ALTER TABLE shop_refund ADD COLUMN IF NOT EXISTS settled_outside_at timestamp with time zone;
--> statement-breakpoint
ALTER TABLE shop_refund ADD COLUMN IF NOT EXISTS settled_outside_reference text;
--> statement-breakpoint
ALTER TABLE shop_refund ADD COLUMN IF NOT EXISTS settled_outside_reason text;
--> statement-breakpoint
ALTER TABLE shop_refund ADD COLUMN IF NOT EXISTS settled_outside_by_subject_id text;
--> statement-breakpoint
ALTER TABLE shop_refund DROP CONSTRAINT IF EXISTS shop_refund_settled_outside_ck;
--> statement-breakpoint
ALTER TABLE shop_refund
  ADD CONSTRAINT shop_refund_settled_outside_ck CHECK (
    (settled_outside_at IS NULL
      AND settled_outside_reference IS NULL
      AND settled_outside_reason IS NULL
      AND settled_outside_by_subject_id IS NULL)
    OR (settled_outside_at IS NOT NULL
      AND settled_outside_reference IS NOT NULL
      AND settled_outside_reason IS NOT NULL
      AND settled_outside_by_subject_id IS NOT NULL)
  );
