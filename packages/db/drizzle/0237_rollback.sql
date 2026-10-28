-- Drops the record of who has closed the organisation welcome card. Roll back the application
-- release first, or invited members see a card the old release cannot dismiss.
ALTER TABLE "legal_entity_member" DROP COLUMN IF EXISTS "welcome_dismissed_at";
