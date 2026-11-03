-- Rollback for 0273_purchase_problem. Roll back the application release first: the previous
-- release neither reads nor writes this table. Reported purchase problems are lost.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "purchase_problem";
