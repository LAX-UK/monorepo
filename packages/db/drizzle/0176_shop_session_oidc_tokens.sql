ALTER TABLE "shop_identity_session" ADD COLUMN "id_token_encrypted" text;
--> statement-breakpoint
ALTER TABLE "shop_identity_session" ADD COLUMN "refresh_token_encrypted" text;
--> statement-breakpoint
ALTER TABLE "shop_identity_session" ADD COLUMN "refresh_expires_at" timestamp with time zone;
