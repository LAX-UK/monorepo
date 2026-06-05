ALTER TABLE "telephone_bid_booking" ADD COLUMN IF NOT EXISTS "approved_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "telephone_bid_booking" ADD COLUMN IF NOT EXISTS "completed_lot_ids" uuid[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "telephone_bid_booking" ADD COLUMN IF NOT EXISTS "limit_increase_requested_at" timestamptz;--> statement-breakpoint
ALTER TABLE "telephone_bid_booking" ADD COLUMN IF NOT EXISTS "limit_increase_amount" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "telephone_bid_booking" ADD COLUMN IF NOT EXISTS "buyer_notes" text;--> statement-breakpoint
ALTER TABLE "telephone_bid_booking" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz;--> statement-breakpoint
ALTER TABLE "telephone_bid_booking" ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "telephone_bid_booking" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "telephone_bid_booking" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "telephone_bid_booking_active_uidx" ON "telephone_bid_booking" ("sale_id", "user_id", "buyer_legal_entity_id")
  WHERE "status" IN ('requested', 'confirmed', 'in_progress');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telephone_bid_booking_user_idx" ON "telephone_bid_booking" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telephone_bid_booking_status_sale_idx" ON "telephone_bid_booking" ("sale_id", "status");
