-- Rollback 0027: Legal Entity Model Foundation 
-- WARNING: This drops all legal entity data. Backfilled rows are lost but re-derivable from user data.

-- 1. Drop columns added to existing tables (in reverse dependency order to avoid lock issues)

-- domain_events
ALTER TABLE "domain_events" DROP COLUMN IF EXISTS "acting_legal_entity_id";

-- user_invitation
ALTER TABLE "user_invitation" DROP COLUMN IF EXISTS "target_legal_entity_member_role";
ALTER TABLE "user_invitation" DROP COLUMN IF EXISTS "target_legal_entity_id";

-- sale
ALTER TABLE "sale" DROP COLUMN IF EXISTS "created_by_legal_entity_id";

-- bid
ALTER TABLE "bid" DROP COLUMN IF EXISTS "buyer_legal_entity_id";

-- payment
ALTER TABLE "payment" DROP COLUMN IF EXISTS "seller_legal_entity_id";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "buyer_legal_entity_id";

-- item_submission
ALTER TABLE "item_submission" DROP COLUMN IF EXISTS "legal_entity_id";

-- lot
ALTER TABLE "lot" DROP COLUMN IF EXISTS "buyer_legal_entity_id";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "artist_review_required";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "artist_id";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "seller_legal_entity_id";

-- artist_profile
ALTER TABLE "artist_profile" DROP CONSTRAINT IF EXISTS "artist_profile_merged_into_integrity";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "owner_legal_entity_id";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "rejection_reason";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "review_notes";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "reviewed_at";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "reviewed_by_user_id";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "created_by_user_id";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "merged_into_artist_id";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "status";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "kind";

-- user
ALTER TABLE "user" DROP COLUMN IF EXISTS "has_seen_acting_context_tooltip";
ALTER TABLE "user" DROP COLUMN IF EXISTS "date_of_birth";
ALTER TABLE "user" DROP COLUMN IF EXISTS "kyc_verified_at";
ALTER TABLE "user" DROP COLUMN IF EXISTS "kyc_status";

-- 2. Drop new tables (in dependency order - children first)
DROP TABLE IF EXISTS "admin_review_task";
DROP TABLE IF EXISTS "artist_alias";
DROP TABLE IF EXISTS "kyc_verification";
DROP TABLE IF EXISTS "payout_line";
DROP TABLE IF EXISTS "payout";
DROP TABLE IF EXISTS "legal_entity_payout_method";
DROP TABLE IF EXISTS "legal_entity_document";
DROP TABLE IF EXISTS "legal_entity_address";
DROP TABLE IF EXISTS "legal_entity_member";
DROP TABLE IF EXISTS "legal_entity";

-- 3. Drop enums
DROP TYPE IF EXISTS "admin_review_task_status";
DROP TYPE IF EXISTS "admin_review_task_kind";
DROP TYPE IF EXISTS "artist_status";
DROP TYPE IF EXISTS "artist_kind";
DROP TYPE IF EXISTS "legal_entity_member_role";
DROP TYPE IF EXISTS "legal_entity_status";
DROP TYPE IF EXISTS "legal_entity_subkind";
DROP TYPE IF EXISTS "legal_entity_kind";
DROP TYPE IF EXISTS "kyc_verification_status";
DROP TYPE IF EXISTS "user_kyc_status";

-- 4. Drop extension (only if no other table uses it - check before dropping in production)
-- Note: pg_trgm is harmless to leave installed; only drop if explicitly needed
-- DROP EXTENSION IF EXISTS pg_trgm;
