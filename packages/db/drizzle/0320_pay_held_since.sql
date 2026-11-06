-- Record when a hold that keeps a buyer from paying began, so releasing it (an organisation
-- cleared to pay, an identity verified) moves only the invoices that fell due during the hold and
-- never debt that was already overdue before it.
--   * legal_entity.pay_held_since: set when an organisation goes from a status that allows paying
--     to one that does not, kept through the steps between held statuses, cleared when it can
--     pay again. Null for an organisation that has never been able to pay.
--   * bid_user_profile.identity_held_since: set when an approved identity stops being approved,
--     cleared on approval. Null for a person who was never approved (held from the start).
-- Additive: two nullable columns, so running services keep working.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "legal_entity" ADD COLUMN IF NOT EXISTS "pay_held_since" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bid_user_profile" ADD COLUMN IF NOT EXISTS "identity_held_since" timestamp with time zone;
--> statement-breakpoint
-- Organisations that cannot pay today are held since they last changed status: the latest
-- moment the hold can have begun, so a release never resets debt that was due earlier.
UPDATE "legal_entity"
SET "pay_held_since" = "status_changed_at"
WHERE "kind" = 'organisation'
  AND "status" IN ('lead', 'docs_requested', 'docs_received', 'under_review', 'rejected', 'archived')
  AND "pay_held_since" IS NULL
  AND "status_changed_at" IS NOT NULL;
