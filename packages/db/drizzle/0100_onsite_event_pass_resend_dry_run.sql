-- Onsite event pass resend (encrypted token storage) and check-in dry-run rehearsal mode

ALTER TABLE "onsite_event"
  ADD COLUMN IF NOT EXISTS "check_in_dry_run" boolean NOT NULL DEFAULT false;

ALTER TABLE "onsite_event_rsvp"
  ADD COLUMN IF NOT EXISTS "check_in_token_ciphertext" text;
