ALTER TABLE "legal_entity_member" ADD COLUMN IF NOT EXISTS "welcome_dismissed_at" timestamp with time zone;
--> statement-breakpoint
-- Members who joined before the welcome card existed have already found their way around.
UPDATE "legal_entity_member"
SET "welcome_dismissed_at" = COALESCE("accepted_at", "created_at")
WHERE "welcome_dismissed_at" IS NULL;
