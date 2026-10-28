ALTER TYPE "public"."item_submission_status" ADD VALUE IF NOT EXISTS 'changes_requested';
--> statement-breakpoint
ALTER TABLE "item_submission" ADD COLUMN IF NOT EXISTS "changes_requested_note" text;
--> statement-breakpoint
ALTER TABLE "item_submission" ADD COLUMN IF NOT EXISTS "changes_requested_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consignment_agreement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL,
  "legal_entity_id" uuid NOT NULL,
  "terms_version" text NOT NULL,
  "estimate_low" numeric(18, 2),
  "estimate_high" numeric(18, 2),
  "reserve_price" numeric(18, 2),
  "commission_percent" numeric(5, 2),
  "currency" text DEFAULT 'GBP' NOT NULL,
  "proposed_by_user_id" text,
  "proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accepted_at" timestamp with time zone,
  "accepted_by_user_id" text,
  "reminder_day3_sent_at" timestamp with time zone,
  "reminder_day7_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "consignment_agreement" ADD CONSTRAINT "consignment_agreement_submission_id_item_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."item_submission"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "consignment_agreement" ADD CONSTRAINT "consignment_agreement_legal_entity_id_legal_entity_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "consignment_agreement" ADD CONSTRAINT "consignment_agreement_proposed_by_user_id_user_id_fk" FOREIGN KEY ("proposed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "consignment_agreement" ADD CONSTRAINT "consignment_agreement_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consignment_agreement_submission_id_uidx" ON "consignment_agreement" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_agreement_legal_entity_id_idx" ON "consignment_agreement" USING btree ("legal_entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_agreement_awaiting_idx" ON "consignment_agreement" USING btree ("proposed_at") WHERE "consignment_agreement"."accepted_at" IS NULL;
--> statement-breakpoint
-- Works a specialist already accepted but nobody has catalogued get a proposal on the first
-- version of the seller conditions, so their sellers can accept it in the product.
INSERT INTO "consignment_agreement" ("submission_id", "legal_entity_id", "terms_version", "proposed_by_user_id", "proposed_at")
SELECT s."id", s."legal_entity_id", 'conditions-of-business-part-c-v1', s."reviewed_by", COALESCE(s."reviewed_at", s."updated_at")
FROM "item_submission" s
WHERE s."status" = 'approved'
ON CONFLICT ("submission_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;
--> statement-breakpoint
ALTER TABLE notification
  ADD CONSTRAINT notification_type_check CHECK (
    type IN (
      'outbid',
      'lot_cancelled',
      'lot_won',
      'lot_lost',
      'lot_ending_soon',
      'watchlist_starting',
      'watchlist_ending_soon',
      'payment_received',
      'payment_due',
      'lot_ended_seller',
      'kyc_resubmission_required',
      'submission_received_for_review',
      'submission_approved',
      'submission_rejected',
      'submission_converted',
      'submission_draft_reminder',
      'submission_changes_requested',
      'consignment_agreement_reminder',
      'condition_report_ready',
      'condition_report_declined',
      'source_of_funds_documents_requested',
      'source_of_funds_approved',
      'source_of_funds_rejected'
    )
  );
