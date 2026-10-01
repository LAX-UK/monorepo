DROP TABLE IF EXISTS "shop_party_invite";
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_admin_idempotency";
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_admin_audit";
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_staff_member";
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_edition_event_edition_idx";
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_edition_event";
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_party_single_lax_uid";
--> statement-breakpoint
ALTER TABLE "shop_party" DROP COLUMN IF EXISTS "stripe_customer_id", DROP COLUMN IF EXISTS "kind";
--> statement-breakpoint
DROP TYPE IF EXISTS "shop_staff_role";
--> statement-breakpoint
DROP TYPE IF EXISTS "shop_party_kind";
