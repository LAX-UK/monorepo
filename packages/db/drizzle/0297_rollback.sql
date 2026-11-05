-- Rollback for 0297_bid_search_trigram_indexes. Searches still work, only slower on large tables.
SET LOCAL lock_timeout = '30s';
DROP INDEX IF EXISTS "user_invitation_email_trgm_idx";
DROP INDEX IF EXISTS "legal_entity_display_name_trgm_idx";
DROP INDEX IF EXISTS "item_submission_title_trgm_idx";
DROP INDEX IF EXISTS "sale_title_trgm_idx";
DROP INDEX IF EXISTS "artist_profile_slug_trgm_idx";
DROP INDEX IF EXISTS "artist_profile_display_name_trgm_idx";
DROP INDEX IF EXISTS "bid_user_profile_mobile_trgm_idx";
DROP INDEX IF EXISTS "bid_identity_directory_email_trgm_idx";
DROP INDEX IF EXISTS "bid_identity_directory_name_trgm_idx";
DROP INDEX IF EXISTS "lot_title_ilike_trgm_idx";
