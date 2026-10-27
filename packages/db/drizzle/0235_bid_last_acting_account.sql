ALTER TABLE "bid_user_profile" ADD COLUMN IF NOT EXISTS "last_acting_legal_entity_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bid_user_profile" ADD CONSTRAINT "bid_user_profile_last_acting_legal_entity_id_legal_entity_id_fk" FOREIGN KEY ("last_acting_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
