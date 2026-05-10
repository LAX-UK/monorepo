-- Seller withdrawal admin queue (B3), Better Auth two-factor (B6), deletion request flag (B5).

ALTER TYPE "admin_review_task_kind" ADD VALUE 'lot_withdrawal_request';

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

CREATE TABLE IF NOT EXISTS "two_factor" (
  "id" text PRIMARY KEY NOT NULL,
  "secret" text NOT NULL,
  "backup_codes" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "verified" boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_user_id_uidx" ON "two_factor" ("user_id");
