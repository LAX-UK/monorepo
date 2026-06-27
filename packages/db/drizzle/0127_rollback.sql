-- Rollback: user phone_number columns (0127_user_phone_number.sql)
DROP INDEX IF EXISTS "user_phone_number_uidx";
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "phone_number_verified";
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "phone_number";
