-- Which sign-in each OAuth token was issued under. Signing out of one browser ends that browser's
-- sign-in and only the tokens issued under it; before this, ending a sign-in could only delete
-- every token of the person.
--
-- oauth_access_token.sid is the `sid` of the ID token returned with the token (the id of the
-- sign-in record at that time), and is copied to each refresh successor. A sign-in record that a
-- newer sign-in in the same browser took over keeps its earlier ids in session_lineage, so the
-- tokens under any of them are found by the record's current id and its earlier names.
--
-- Additive and nullable: tokens issued before this carry none and behave as before. Not a foreign
-- key, because the record it names may already have been taken over or ended.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "oauth_access_token" ADD COLUMN IF NOT EXISTS "sid" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_access_token_user_sid_idx"
  ON "oauth_access_token" ("user_id", "sid") WHERE "sid" IS NOT NULL;
