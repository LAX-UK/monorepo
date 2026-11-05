-- Trigram indexes for the Bid admin searches that match typed text with `ilike '%text%'`.
-- The existing lot_title_trgm_idx is on lower(title), which `ilike` on the bare column cannot use,
-- so the lot title gets a second index on the column itself.
-- Plain CREATE INDEX: the migration runner is transactional, so CONCURRENTLY is not available.
-- Each build blocks writes to its table for the few seconds it takes at current table sizes.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lot_title_ilike_trgm_idx" ON "lot" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_identity_directory_name_trgm_idx" ON "bid_identity_directory" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_identity_directory_email_trgm_idx" ON "bid_identity_directory" USING gin ("email" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_user_profile_mobile_trgm_idx" ON "bid_user_profile" USING gin ("mobile" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artist_profile_display_name_trgm_idx" ON "artist_profile" USING gin ("display_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artist_profile_slug_trgm_idx" ON "artist_profile" USING gin ("slug" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_title_trgm_idx" ON "sale" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_submission_title_trgm_idx" ON "item_submission" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_entity_display_name_trgm_idx" ON "legal_entity" USING gin ("display_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_invitation_email_trgm_idx" ON "user_invitation" USING gin ("email" gin_trgm_ops);
