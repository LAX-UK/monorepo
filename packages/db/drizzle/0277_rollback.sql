-- Rollback for 0277_enquiry_workflow. Roll back the application release first: the previous
-- release reads only the original columns and the two original statuses. Notes, replies,
-- attachments, private sale details, routing rules and the new columns are lost, and an enquiry
-- that was in progress or converted returns as new.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "enquiry_routing_rule";
--> statement-breakpoint
DROP TABLE IF EXISTS "marketing_enquiry_message";
--> statement-breakpoint
DROP TABLE IF EXISTS "marketing_enquiry_note";
--> statement-breakpoint
DROP TABLE IF EXISTS "marketing_enquiry_attachment";
--> statement-breakpoint
DROP TABLE IF EXISTS "private_sale_enquiry_detail";
--> statement-breakpoint
DROP INDEX IF EXISTS "marketing_enquiry_intent_created_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "marketing_enquiry_assignee_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "marketing_enquiry_open_created_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "marketing_enquiry_reference_uidx";
--> statement-breakpoint
ALTER TABLE "marketing_enquiry"
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_status_check",
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_handled_check",
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_close_reason_check",
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_intent_check",
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_version_check";
--> statement-breakpoint
-- Closed enquiries are the previous release's handled ones; every other open state is new.
UPDATE "marketing_enquiry"
SET "status" = CASE WHEN "status" = 'closed' THEN 'handled' ELSE 'new' END,
    "handled_at" = CASE WHEN "status" = 'closed' THEN "handled_at" ELSE NULL END,
    "handled_by_user_id" = CASE WHEN "status" = 'closed' THEN "handled_by_user_id" ELSE NULL END;
--> statement-breakpoint
ALTER TABLE "marketing_enquiry"
  DROP COLUMN IF EXISTS "version",
  DROP COLUMN IF EXISTS "marketing_opt_in",
  DROP COLUMN IF EXISTS "legal_entity_id",
  DROP COLUMN IF EXISTS "user_id",
  DROP COLUMN IF EXISTS "department_slug",
  DROP COLUMN IF EXISTS "assigned_to_user_id",
  DROP COLUMN IF EXISTS "close_reason",
  DROP COLUMN IF EXISTS "intent",
  DROP COLUMN IF EXISTS "reference";
--> statement-breakpoint
DROP SEQUENCE IF EXISTS "marketing_enquiry_reference_seq";
--> statement-breakpoint
ALTER TABLE "marketing_enquiry"
  ADD CONSTRAINT "marketing_enquiry_status_check" CHECK ("status" IN ('new', 'handled')),
  ADD CONSTRAINT "marketing_enquiry_handled_check"
    CHECK (("status" = 'handled') = ("handled_at" IS NOT NULL));
