-- Puts back the twelve previous Bid staff roles and the eight organisation member roles. Roll
-- back the application release first.
--
-- Everyone in the snapshot gets back exactly the assignments and the single role they had before
-- the clean-up; changes made to their roles since are lost. People who became staff after it
-- keep their roles under the nearest previous name (client services -> client advisor,
-- saleroom clerk and read-only -> staff viewer).
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TEMP TABLE "staff_role_rollback_map" ("new_role" text, "old_role" text) ON COMMIT DROP;
--> statement-breakpoint
INSERT INTO "staff_role_rollback_map" ("new_role", "old_role") VALUES
  ('administrator', 'super_admin'),
  ('sales_manager', 'auction_manager'),
  ('saleroom_clerk', 'staff_viewer'),
  ('cataloguer', 'catalogue_manager'),
  ('specialist', 'specialist'),
  ('client_services', 'client_advisor'),
  ('finance', 'finance_ops'),
  ('fulfilment', 'operations_fulfilment'),
  ('compliance', 'compliance_officer'),
  ('read_only', 'staff_viewer');
--> statement-breakpoint
DROP TRIGGER IF EXISTS "lax_staff_access_directory_bid_profile" ON "bid_user_profile";
--> statement-breakpoint
ALTER TABLE "staff_role_assignment" ALTER COLUMN "role" TYPE text;
--> statement-breakpoint
ALTER TABLE "bid_user_profile" ALTER COLUMN "staff_role" TYPE text;
--> statement-breakpoint
ALTER TABLE "user_invitation" ALTER COLUMN "target_staff_role" TYPE text;
--> statement-breakpoint
DROP TYPE "user_staff_role";
--> statement-breakpoint
CREATE TYPE "user_staff_role" AS ENUM ('super_admin', 'auction_manager', 'catalogue_manager', 'specialist', 'finance_ops', 'operations_fulfilment', 'content_marketing', 'support_concierge', 'staff_viewer', 'compliance_officer', 'client_advisor', 'operations');
--> statement-breakpoint
-- People in the snapshot: their assignments and single role exactly as they were.
DELETE FROM "staff_role_assignment" a
USING "staff_role_cleanup_snapshot" s
WHERE a."user_id" = s."user_id";
--> statement-breakpoint
INSERT INTO "staff_role_assignment"
  ("id", "user_id", "role", "starts_at", "ends_at", "granted_by_user_id", "granted_at", "reason")
SELECT (a->>'id')::uuid, s."user_id", a->>'role', (a->>'starts_at')::timestamptz,
       (a->>'ends_at')::timestamptz, a->>'granted_by_user_id', (a->>'granted_at')::timestamptz,
       a->>'reason'
FROM "staff_role_cleanup_snapshot" s
CROSS JOIN LATERAL jsonb_array_elements(s."assignments") a
WHERE EXISTS (SELECT 1 FROM "bid_user_profile" p WHERE p."user_id" = s."user_id")
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "bid_user_profile" p
SET "staff_role" = s."profile_staff_role"
FROM "staff_role_cleanup_snapshot" s
WHERE s."user_id" = p."user_id";
--> statement-breakpoint
-- Everyone else: the nearest previous name. Two roles that meet in one keep the earliest.
CREATE TEMP TABLE "staff_role_rollback_rest" ON COMMIT DROP AS
SELECT a.* FROM "staff_role_assignment" a
WHERE NOT EXISTS (SELECT 1 FROM "staff_role_cleanup_snapshot" s WHERE s."user_id" = a."user_id");
--> statement-breakpoint
DELETE FROM "staff_role_assignment" a
WHERE NOT EXISTS (SELECT 1 FROM "staff_role_cleanup_snapshot" s WHERE s."user_id" = a."user_id");
--> statement-breakpoint
INSERT INTO "staff_role_assignment"
  ("id", "user_id", "role", "starts_at", "ends_at", "granted_by_user_id", "granted_at", "reason")
SELECT r."id", r."user_id", m."old_role", r."starts_at", r."ends_at", r."granted_by_user_id",
       r."granted_at", r."reason"
FROM "staff_role_rollback_rest" r
JOIN "staff_role_rollback_map" m ON m."new_role" = r."role"
ORDER BY r."starts_at"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "bid_user_profile" p
SET "staff_role" = m."old_role"
FROM "staff_role_rollback_map" m
WHERE m."new_role" = p."staff_role"
  AND NOT EXISTS (SELECT 1 FROM "staff_role_cleanup_snapshot" s WHERE s."user_id" = p."user_id");
--> statement-breakpoint
UPDATE "user_invitation" i
SET "target_staff_role" = m."old_role"
FROM "staff_role_rollback_map" m
WHERE m."new_role" = i."target_staff_role";
--> statement-breakpoint
UPDATE "user_invitation_product_grant" g
SET "role" = m."old_role"
FROM "staff_role_rollback_map" m
WHERE g."product" = 'bid' AND m."new_role" = g."role";
--> statement-breakpoint
UPDATE "data_exports" e
SET "user_staff_role" = m."old_role"
FROM "staff_role_rollback_map" m
WHERE m."new_role" = e."user_staff_role";
--> statement-breakpoint
ALTER TABLE "staff_role_assignment"
  ALTER COLUMN "role" TYPE "user_staff_role" USING "role"::"user_staff_role";
--> statement-breakpoint
ALTER TABLE "bid_user_profile"
  ALTER COLUMN "staff_role" TYPE "user_staff_role" USING "staff_role"::"user_staff_role";
--> statement-breakpoint
ALTER TABLE "user_invitation"
  ALTER COLUMN "target_staff_role" TYPE "user_staff_role" USING "target_staff_role"::"user_staff_role";
--> statement-breakpoint
CREATE TRIGGER "lax_staff_access_directory_bid_profile"
AFTER INSERT OR DELETE OR UPDATE OF "role", "staff_role" ON public."bid_user_profile"
FOR EACH ROW EXECUTE FUNCTION public.lax_staff_access_directory_from_bid_profile();
--> statement-breakpoint
UPDATE "lax_staff_access_directory" d
SET "role" = p."staff_role"::text, "updated_at" = now()
FROM "bid_user_profile" p
WHERE d."product" = 'bid' AND d."subject_id" = p."user_id"
  AND p."role" = 'staff' AND p."staff_role" IS NOT NULL
  AND d."role" IS DISTINCT FROM p."staff_role"::text;
--> statement-breakpoint
DROP TABLE "staff_role_cleanup_snapshot";
--> statement-breakpoint
ALTER TABLE "legal_entity_member" DROP CONSTRAINT IF EXISTS "legal_entity_member_primary_admin_role";
--> statement-breakpoint
ALTER TYPE "legal_entity_member_role" RENAME TO "legal_entity_member_role_current";
--> statement-breakpoint
CREATE TYPE "legal_entity_member_role" AS ENUM ('owner', 'admin', 'consignor', 'finance', 'buyer_agent', 'viewer', 'specialist', 'staff');
--> statement-breakpoint
ALTER TABLE "legal_entity_member"
  ALTER COLUMN "role" TYPE "legal_entity_member_role" USING "role"::text::"legal_entity_member_role";
--> statement-breakpoint
DROP TYPE "legal_entity_member_role_current";
--> statement-breakpoint
ALTER TABLE "legal_entity_member" ADD CONSTRAINT "legal_entity_member_primary_admin_role"
  CHECK (NOT "is_primary_admin" OR "role" IN ('owner', 'admin'));
