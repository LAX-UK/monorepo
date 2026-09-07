ALTER TABLE "oauth_application"
  ADD COLUMN IF NOT EXISTS "enable_end_session" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE "oauth_application"
SET "enable_end_session" = true,
    "updated_at" = now()
WHERE "client_id" IN ('lax-bid-web', 'lax-shop-web');
