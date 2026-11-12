-- One sign-in record per browser. Each issuer session records which browser it belongs to (a keyed
-- hash of the private device marker, never the marker itself), when the person first signed in
-- there, when it was last used and from which country. A new sign-in in the same browser takes the
-- old record over: the old record is deleted and its id is remembered in session_lineage, so a
-- product that still holds the old id keeps working against the new record.
--
-- Additive and nullable: records made before this carry none of it and work exactly as before.
-- Nothing here is read for authentication, and the previous release ignores all of it.
--
-- session_lineage: previous_sid is the id of a record that was taken over, session_id the record
-- that now stands for it, user_id the person (a name only ever resolves for that person). The
-- issuer keeps at most 20 earlier names per record. Rows go with the record, or with the person.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "device_hash" text;
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "signed_in_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "country" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_device_hash_user_idx"
  ON "session" ("device_hash", "user_id") WHERE "device_hash" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_lineage" (
  "previous_sid" text PRIMARY KEY,
  "session_id" text NOT NULL REFERENCES "session"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_lineage_session_id_idx" ON "session_lineage" ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_lineage_user_id_idx" ON "session_lineage" ("user_id");
