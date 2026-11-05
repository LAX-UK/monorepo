-- The marketing-contacts sync audit log only served the retired outbound contact sync. Nothing
-- reads or writes it any more, so the table goes. email_suppression is untouched.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "marketing_contact_sync_log";
