-- A message from LAX to an organisation's members about why it is restricted or was not
-- approved, written by staff to be read by the client. `status_reason` stays the staff note.
-- Additive: one nullable column, so running services keep working. Empty means the screens keep
-- their standard wording.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "legal_entity" ADD COLUMN IF NOT EXISTS "client_message" text;
