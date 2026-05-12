ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_staff_role_only_for_staff";
ALTER TABLE "user" DROP COLUMN IF EXISTS "staff_role";
DROP TYPE IF EXISTS "user_staff_role";
