-- Rollback for 0272_marketing_enquiry. Roll back the application release first: the previous
-- release neither reads nor writes this table. Stored enquiries are lost.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "marketing_enquiry";
