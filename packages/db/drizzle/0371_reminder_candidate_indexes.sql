-- Serve the bounded candidate queries of the payment and deal reminder jobs. Each index is
-- partial on the state the job filters on and keyed on the deadline the job bounds, so the job no
-- longer scans every ended lot or every open deal. Additive: indexes only, no data change.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reminder_candidate_idx"
  ON "payment" ("created_at")
  WHERE "status" IN ('pending', 'cancelled');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_payment_due_idx"
  ON "private_sale_deal" ("payment_due_at")
  WHERE "stage" = 'invoiced' AND "payment_due_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_collection_due_idx"
  ON "private_sale_deal" ("collection_due_at")
  WHERE "stage" = 'paid' AND "collection_due_at" IS NOT NULL;
