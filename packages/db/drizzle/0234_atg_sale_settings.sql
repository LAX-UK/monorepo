ALTER TABLE "atg_auction_link" ADD COLUMN IF NOT EXISTS "auction_type" text DEFAULT 'Timed' NOT NULL;
--> statement-breakpoint
ALTER TABLE "atg_auction_link" ADD COLUMN IF NOT EXISTS "distribution" text DEFAULT 'private_test' NOT NULL;
--> statement-breakpoint
ALTER TABLE "atg_auction_link" ADD COLUMN IF NOT EXISTS "settings_updated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "atg_auction_link" ADD COLUMN IF NOT EXISTS "settings_updated_by" text;
--> statement-breakpoint
ALTER TABLE "atg_lot_link" ADD COLUMN IF NOT EXISTS "locked_fields_hash" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "atg_auction_link" ADD CONSTRAINT "atg_auction_link_auction_type_check" CHECK ("auction_type" IN ('Timed', 'Live'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "atg_auction_link" ADD CONSTRAINT "atg_auction_link_distribution_check" CHECK ("distribution" IN ('private_test', 'public_marketplace'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
