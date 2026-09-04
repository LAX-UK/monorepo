DROP INDEX IF EXISTS "oauth_consent_client_user_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "domain_events_user_linked_external_uid"
  ON "domain_events" ("aggregate_type", "aggregate_id")
  WHERE "event_type" = 'user.linked_external';

-- Duplicate oauth_consent row identities merged by the forward migration cannot
-- be reconstructed. Their complete grant union remains on the survivor.
