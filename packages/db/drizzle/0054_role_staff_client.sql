BEGIN;

-- 1. Backfill staff_role for legacy administrator/accountant rows.
UPDATE "user" SET "staff_role" = 'super_admin'
WHERE "role" = 'administrator' AND "staff_role" IS NULL;
UPDATE "user" SET "staff_role" = 'finance_ops'
WHERE "role" = 'accountant' AND "staff_role" IS NULL;

-- 2. Drop constraints that reject role='staff'.
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_role_v1_check";
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_staff_role_only_for_staff";

-- 3. Collapse role values.
UPDATE "user" SET "role" = 'staff'
WHERE "role" IN ('administrator', 'accountant');

-- 4. New constraints.
ALTER TABLE "user" ADD CONSTRAINT "user_role_v2_check"
  CHECK ("role" IN ('staff', 'client'));
ALTER TABLE "user" ADD CONSTRAINT "user_staff_role_iff_staff"
  CHECK (("role" = 'staff') = ("staff_role" IS NOT NULL));

-- 5. Invitations: add target_staff_role and migrate.
ALTER TABLE "user_invitation"
  ADD COLUMN "target_staff_role" "user_staff_role";

ALTER TABLE "user_invitation" DROP CONSTRAINT IF EXISTS "user_invitation_target_role_check";

UPDATE "user_invitation" SET "target_role" = 'staff', "target_staff_role" = 'super_admin'
WHERE "target_role" = 'administrator';
UPDATE "user_invitation" SET "target_role" = 'staff', "target_staff_role" = 'finance_ops'
WHERE "target_role" = 'accountant';

ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_target_role_v2_check"
  CHECK ("target_role" IN ('staff', 'client'));
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_target_staff_role_iff_staff"
  CHECK (("target_role" = 'staff') = ("target_staff_role" IS NOT NULL));

COMMIT;
