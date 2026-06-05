DROP TABLE IF EXISTS "onsite_event_check_in_log";

DROP INDEX IF EXISTS "onsite_event_rsvp_checked_in_at_idx";
DROP INDEX IF EXISTS "onsite_event_rsvp_check_in_token_hash_uq";

ALTER TABLE "onsite_event_rsvp"
  DROP COLUMN IF EXISTS "check_in_party_count",
  DROP COLUMN IF EXISTS "checked_in_by_user_id",
  DROP COLUMN IF EXISTS "checked_in_at",
  DROP COLUMN IF EXISTS "check_in_token_issued_at",
  DROP COLUMN IF EXISTS "check_in_token_hash";
