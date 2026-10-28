CREATE TABLE IF NOT EXISTS "unsold_lot_choice" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL,
  "submission_id" uuid NOT NULL,
  "legal_entity_id" uuid NOT NULL,
  "lot_end_time" timestamp with time zone NOT NULL,
  "status" text NOT NULL,
  "requested_choice" text,
  "requested_reserve" numeric(18, 2),
  "requested_by_user_id" text,
  "requested_at" timestamp with time zone,
  "decided_choice" text,
  "decided_reserve" numeric(18, 2),
  "decided_by_user_id" text,
  "decided_at" timestamp with time zone,
  "staff_note" text,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "unsold_lot_choice_status_check" CHECK ("status" IN ('requested', 'confirmed')),
  CONSTRAINT "unsold_lot_choice_choice_check" CHECK (
    ("requested_choice" IS NULL OR "requested_choice" IN ('relist', 'private_sale', 'collect'))
    AND ("decided_choice" IS NULL OR "decided_choice" IN ('relist', 'private_sale', 'collect'))
  )
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unsold_lot_choice" ADD CONSTRAINT "unsold_lot_choice_lot_id_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unsold_lot_choice" ADD CONSTRAINT "unsold_lot_choice_submission_id_item_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."item_submission"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unsold_lot_choice" ADD CONSTRAINT "unsold_lot_choice_legal_entity_id_legal_entity_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unsold_lot_choice" ADD CONSTRAINT "unsold_lot_choice_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unsold_lot_choice" ADD CONSTRAINT "unsold_lot_choice_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unsold_lot_choice_lot_id_idx" ON "unsold_lot_choice" USING btree ("lot_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unsold_lot_choice_submission_id_idx" ON "unsold_lot_choice" USING btree ("submission_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unsold_lot_choice_outcome_uidx" ON "unsold_lot_choice" USING btree ("lot_id", "lot_end_time");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unsold_lot_choice_requested_idx" ON "unsold_lot_choice" USING btree ("requested_at") WHERE "unsold_lot_choice"."status" = 'requested';
--> statement-breakpoint
ALTER TABLE "consignment_agreement" ADD COLUMN IF NOT EXISTS "relist_reserve_floor" numeric(18, 2);
--> statement-breakpoint
ALTER TABLE "item_submission" ADD COLUMN IF NOT EXISTS "identity_reminder_sent_at" timestamp with time zone;
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
      'consignment_update',
      'condition_report_ready',
      'condition_report_declined',
      'source_of_funds_documents_requested',
      'source_of_funds_approved',
      'source_of_funds_rejected'
    )
  );
