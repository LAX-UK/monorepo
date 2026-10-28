ALTER TABLE "item_submission" ADD COLUMN IF NOT EXISTS "submitted_by_user_id" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "item_submission" ADD CONSTRAINT "item_submission_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_submission_entity_submitted_by_idx" ON "item_submission" USING btree ("legal_entity_id","submitted_by_user_id");
