-- Bid staff roles become one role per job: administrator, sales manager, saleroom clerk,
-- cataloguer, specialist, client services, finance, fulfilment, compliance and read-only.
-- Operations and content marketing are removed. Every person's assignments move to the roles
-- that give them at least the access they had, and the unused organisation member roles
-- `specialist` and `staff` are dropped.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
-- Organisation roles: stop, rather than change anything silently, if a membership or a pending
-- invitation still uses a value being removed.
DO $$
DECLARE
  memberships integer;
  invitations integer;
BEGIN
  SELECT count(*) INTO memberships
  FROM "legal_entity_member" WHERE "role"::text IN ('specialist', 'staff');
  SELECT count(*) INTO invitations
  FROM "user_invitation"
  WHERE "status" = 'pending' AND "target_legal_entity_member_role" IN ('specialist', 'staff');
  IF memberships > 0 OR invitations > 0 THEN
    RAISE EXCEPTION 'organisation roles specialist and staff are still used (% memberships, % pending invitations); move them to a current role first',
      memberships, invitations;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "legal_entity_member" DROP CONSTRAINT IF EXISTS "legal_entity_member_primary_admin_role";
--> statement-breakpoint
ALTER TYPE "legal_entity_member_role" RENAME TO "legal_entity_member_role_retired";
--> statement-breakpoint
CREATE TYPE "legal_entity_member_role" AS ENUM ('owner', 'admin', 'consignor', 'finance', 'buyer_agent', 'viewer');
--> statement-breakpoint
ALTER TABLE "legal_entity_member"
  ALTER COLUMN "role" TYPE "legal_entity_member_role" USING "role"::text::"legal_entity_member_role";
--> statement-breakpoint
DROP TYPE "legal_entity_member_role_retired";
--> statement-breakpoint
ALTER TABLE "legal_entity_member" ADD CONSTRAINT "legal_entity_member_primary_admin_role"
  CHECK (NOT "is_primary_admin" OR "role" IN ('owner', 'admin'));
--> statement-breakpoint
-- Every staff member's roles as they were, so the rollback restores them exactly. Dropped by the
-- follow-up migration that removes bid_user_profile.staff_role.
CREATE TABLE "staff_role_cleanup_snapshot" (
  "user_id" text PRIMARY KEY NOT NULL,
  "profile_staff_role" text,
  "assignments" jsonb NOT NULL,
  "taken_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "staff_role_cleanup_snapshot" ("user_id", "profile_staff_role", "assignments")
SELECT p."user_id",
       p."staff_role"::text,
       COALESCE(
         (SELECT jsonb_agg(to_jsonb(a) - 'role' || jsonb_build_object('role', a."role"::text))
          FROM "staff_role_assignment" a WHERE a."user_id" = p."user_id"),
         '[]'::jsonb
       )
FROM "bid_user_profile" p
WHERE p."staff_role" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "staff_role_assignment" a WHERE a."user_id" = p."user_id");
--> statement-breakpoint
-- Old role -> new roles. `position` orders a person's new roles; the first is the one screens
-- show. A role with one successor keeps its assignment row (dates, grantor, reason); a role with
-- several gets a new row per successor.
CREATE TEMP TABLE "staff_role_cleanup_map" ("old_role" text, "new_role" text, "position" integer) ON COMMIT DROP;
--> statement-breakpoint
INSERT INTO "staff_role_cleanup_map" ("old_role", "new_role", "position") VALUES
  ('super_admin', 'administrator', 1),
  ('auction_manager', 'sales_manager', 1),
  ('catalogue_manager', 'cataloguer', 1),
  ('specialist', 'specialist', 1),
  ('finance_ops', 'finance', 1),
  ('operations_fulfilment', 'fulfilment', 1),
  ('compliance_officer', 'compliance', 1),
  ('operations', 'sales_manager', 1),
  ('operations', 'cataloguer', 2),
  ('operations', 'client_services', 3),
  ('operations', 'fulfilment', 4),
  ('support_concierge', 'client_services', 1),
  ('client_advisor', 'client_services', 1),
  ('content_marketing', 'read_only', 1),
  ('staff_viewer', 'read_only', 1);
--> statement-breakpoint
-- The directory trigger watches staff_role, which blocks changing the column's type. It is put
-- back below, and the directory re-synced.
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
CREATE TYPE "user_staff_role" AS ENUM ('administrator', 'sales_manager', 'saleroom_clerk', 'cataloguer', 'specialist', 'client_services', 'finance', 'fulfilment', 'compliance', 'read_only');
--> statement-breakpoint
-- Assignments: rebuild from the snapshot through the map. Where two old roles meet in one new
-- role, the earliest assignment is kept.
DELETE FROM "staff_role_assignment";
--> statement-breakpoint
INSERT INTO "staff_role_assignment"
  ("id", "user_id", "role", "starts_at", "ends_at", "granted_by_user_id", "granted_at", "reason")
SELECT
  CASE WHEN fanout."n" = 1 THEN (a->>'id')::uuid ELSE gen_random_uuid() END,
  s."user_id",
  m."new_role",
  (a->>'starts_at')::timestamptz,
  (a->>'ends_at')::timestamptz,
  CASE WHEN fanout."n" = 1 THEN a->>'granted_by_user_id' END,
  CASE WHEN fanout."n" = 1 THEN (a->>'granted_at')::timestamptz ELSE now() END,
  CASE WHEN fanout."n" = 1 THEN a->>'reason' ELSE 'role clean-up: replaces ' || (a->>'role') END
FROM "staff_role_cleanup_snapshot" s
CROSS JOIN LATERAL jsonb_array_elements(s."assignments") a
JOIN "staff_role_cleanup_map" m ON m."old_role" = a->>'role'
JOIN (SELECT "old_role", count(*) AS "n" FROM "staff_role_cleanup_map" GROUP BY "old_role") fanout
  ON fanout."old_role" = m."old_role"
ORDER BY (a->>'starts_at')::timestamptz, m."position"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- The single role screens show: the first successor of the person's previous one.
UPDATE "bid_user_profile" p
SET "staff_role" = m."new_role"
FROM "staff_role_cleanup_map" m
WHERE m."old_role" = p."staff_role" AND m."position" = 1;
--> statement-breakpoint
UPDATE "user_invitation" i
SET "target_staff_role" = m."new_role"
FROM "staff_role_cleanup_map" m
WHERE m."old_role" = i."target_staff_role" AND m."position" = 1;
--> statement-breakpoint
UPDATE "user_invitation_product_grant" g
SET "role" = m."new_role"
FROM "staff_role_cleanup_map" m
WHERE g."product" = 'bid' AND m."old_role" = g."role" AND m."position" = 1;
--> statement-breakpoint
UPDATE "data_exports" e
SET "user_staff_role" = m."new_role"
FROM "staff_role_cleanup_map" m
WHERE m."old_role" = e."user_staff_role" AND m."position" = 1;
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
