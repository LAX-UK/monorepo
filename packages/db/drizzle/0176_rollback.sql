ALTER TABLE "shop_identity_session" DROP COLUMN "refresh_expires_at";
--> statement-breakpoint
ALTER TABLE "shop_identity_session" DROP COLUMN "refresh_token_encrypted";
--> statement-breakpoint
ALTER TABLE "shop_identity_session" DROP COLUMN "id_token_encrypted";
