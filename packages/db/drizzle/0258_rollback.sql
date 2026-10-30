-- Rollback for 0258_workspace_selling_modules. Roll back the application release first: the
-- previous release neither reads nor writes these. Consignment reference numbers and the stored
-- unsold-choice dates are lost; the dates fall back to the window rule.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "unsold_choice_deadline";
--> statement-breakpoint
DROP INDEX IF EXISTS "item_submission_reference_number_uidx";
--> statement-breakpoint
ALTER TABLE "item_submission" DROP COLUMN IF EXISTS "reference_number";
--> statement-breakpoint
DROP SEQUENCE IF EXISTS "item_submission_reference_seq";
