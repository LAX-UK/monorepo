BEGIN;

ALTER TABLE "user_invitation" DROP CONSTRAINT IF EXISTS "user_invitation_target_staff_role_iff_staff";
ALTER TABLE "user_invitation" DROP CONSTRAINT IF EXISTS "user_invitation_target_role_v2_check";

UPDATE "user_invitation" SET "target_role" = 'accountant', "target_staff_role" = NULL
WHERE "target_role" = 'staff' AND "target_staff_role" = 'finance_ops';
UPDATE "user_invitation" SET "target_role" = 'administrator', "target_staff_role" = NULL
WHERE "target_role" = 'staff' AND "target_staff_role" IS NOT NULL;

ALTER TABLE "user_invitation" DROP COLUMN IF EXISTS "target_staff_role";

ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_target_role_check"
  CHECK ("target_role" IN ('administrator', 'accountant', 'client'));

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_staff_role_iff_staff";
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_role_v2_check";

UPDATE "user" SET "role" = 'accountant'
WHERE "role" = 'staff' AND "staff_role" = 'finance_ops';
UPDATE "user" SET "role" = 'administrator'
WHERE "role" = 'staff' AND "staff_role" IS NOT NULL AND "staff_role" <> 'finance_ops';

ALTER TABLE "user" ADD CONSTRAINT "user_role_v1_check"
  CHECK ("role" IN ('administrator', 'accountant', 'client'));
ALTER TABLE "user" ADD CONSTRAINT "user_staff_role_only_for_staff" CHECK (
  "staff_role" IS NULL OR "role" IN ('administrator', 'accountant')
);

COMMIT;
