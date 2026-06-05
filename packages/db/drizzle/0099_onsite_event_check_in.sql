-- Onsite event check-in tokens and audit log

ALTER TABLE "onsite_event_rsvp"
  ADD COLUMN IF NOT EXISTS "check_in_token_hash" text,
  ADD COLUMN IF NOT EXISTS "check_in_token_issued_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "checked_in_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "checked_in_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "check_in_party_count" smallint;

CREATE UNIQUE INDEX IF NOT EXISTS "onsite_event_rsvp_check_in_token_hash_uq"
  ON "onsite_event_rsvp" ("check_in_token_hash")
  WHERE "check_in_token_hash" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "onsite_event_rsvp_checked_in_at_idx"
  ON "onsite_event_rsvp" ("event_slug", "checked_in_at");

CREATE TABLE IF NOT EXISTS "onsite_event_check_in_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rsvp_id" uuid REFERENCES "onsite_event_rsvp"("id") ON DELETE SET NULL,
  "event_slug" text NOT NULL,
  "staff_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "result" text NOT NULL,
  "raw_input_hash" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "onsite_event_check_in_log_event_slug_idx"
  ON "onsite_event_check_in_log" ("event_slug", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "onsite_event_check_in_log_rsvp_idx"
  ON "onsite_event_check_in_log" ("rsvp_id");
