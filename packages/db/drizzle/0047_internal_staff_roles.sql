-- Internal LAX staff roles (nullable on user; only meaningful for administrator/accountant).
CREATE TYPE "user_staff_role" AS ENUM (
  'super_admin',
  'auction_manager',
  'catalogue_manager',
  'specialist',
  'finance_ops',
  'operations_fulfilment',
  'content_marketing',
  'support_concierge',
  'staff_viewer'
);

ALTER TABLE "user" ADD COLUMN "staff_role" "user_staff_role";

ALTER TABLE "user" ADD CONSTRAINT "user_staff_role_only_for_staff" CHECK (
  "staff_role" IS NULL OR "role" IN ('administrator', 'accountant')
);

COMMENT ON COLUMN "user"."staff_role" IS 'LAX internal role when user.role is administrator or accountant; null = legacy full-admin (admin) or full-finance (accountant) behaviour.';
