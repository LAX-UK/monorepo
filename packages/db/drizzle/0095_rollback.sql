DROP INDEX IF EXISTS "sale_venue_id_idx";--> statement-breakpoint
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_venue_id_venue_id_fk";--> statement-breakpoint
ALTER TABLE "sale" DROP COLUMN IF EXISTS "venue_id";--> statement-breakpoint
DROP INDEX IF EXISTS "venue_legal_entity_slug_uidx";--> statement-breakpoint
DROP INDEX IF EXISTS "venue_not_deleted_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "venue_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "venue_legal_entity_id_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "venue";--> statement-breakpoint
DROP TYPE IF EXISTS "venue_status";
