SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "shop_refund_source" AS ENUM ('admin', 'cancellation', 'stripe_dashboard');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "shop_refund"
  ADD COLUMN IF NOT EXISTS "source" "shop_refund_source" DEFAULT 'admin' NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_refund"
  ADD COLUMN IF NOT EXISTS "submit_attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_refund"
  ADD COLUMN IF NOT EXISTS "last_error" text;
--> statement-breakpoint
ALTER TABLE "shop_refund"
  ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_refund_stripe_refund_uid"
  ON "shop_refund" ("stripe_refund_id")
  WHERE "stripe_refund_id" IS NOT NULL;
