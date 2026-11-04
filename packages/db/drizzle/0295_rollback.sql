-- Rollback for 0295_private_sale_deal. Roll back the application release first: the previous
-- release neither writes nor reads private sale deals. Every deal, its parties, stage history
-- and documents are lost, so export them first if any real deal has been recorded.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "private_sale_deal_document";
--> statement-breakpoint
DROP TABLE IF EXISTS "private_sale_deal_stage_history";
--> statement-breakpoint
DROP TABLE IF EXISTS "private_sale_deal_party";
--> statement-breakpoint
DROP TABLE IF EXISTS "private_sale_deal";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "private_sale_deal_stage_history_guard"();
--> statement-breakpoint
DROP SEQUENCE IF EXISTS "private_sale_deal_reference_seq";
