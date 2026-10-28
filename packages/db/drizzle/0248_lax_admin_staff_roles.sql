-- LAX Admin moves to the role model Bid admin uses: several roles per person, each with an
-- optional end date. Two roles are added: Editor (stories, exhibitions and pages, taken out of
-- Catalogue editor) and Read-only. Every active staff member keeps the role they hold today as
-- their first assignment, and catalogue editors are given Editor as well, so nobody loses access.
-- Bid reads each assignment through a trigger-maintained directory, as it reads the single role.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
-- The role column is named in a trigger definition, so the trigger steps aside while the role
-- type is rebuilt with the two new values (a value added in place could not be used below).
DROP TRIGGER IF EXISTS lax_staff_access_directory_shop_staff ON public."shop_staff_member";
--> statement-breakpoint
ALTER TYPE "shop_staff_role" RENAME TO "shop_staff_role_single";
--> statement-breakpoint
CREATE TYPE "shop_staff_role" AS ENUM ('shop_admin', 'account_manager', 'broker', 'operations', 'finance', 'catalogue_editor', 'editor', 'read_only');
--> statement-breakpoint
ALTER TABLE "shop_staff_member"
  ALTER COLUMN "role" TYPE "shop_staff_role" USING "role"::text::"shop_staff_role";
--> statement-breakpoint
DROP TYPE "shop_staff_role_single";
--> statement-breakpoint
CREATE TRIGGER lax_staff_access_directory_shop_staff
AFTER INSERT OR DELETE OR UPDATE OF "identity_subject_id", "role", "disabled_at" ON public."shop_staff_member"
FOR EACH ROW EXECUTE FUNCTION public.lax_staff_access_directory_from_shop_staff();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_staff_role_assignment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_subject_id" text NOT NULL,
  "role" "shop_staff_role" NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "granted_by_subject_id" text,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reason" text,
  "end_recorded_at" timestamp with time zone,
  "granted_event_id" bigint,
  "ended_event_id" bigint,
  CONSTRAINT "shop_staff_role_assignment_subject_fk"
    FOREIGN KEY ("identity_subject_id") REFERENCES "public"."shop_staff_member"("identity_subject_id")
    ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_staff_role_assignment_open_uidx" ON "shop_staff_role_assignment" USING btree ("identity_subject_id","role") WHERE "shop_staff_role_assignment"."ends_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_staff_role_assignment_subject_idx" ON "shop_staff_role_assignment" USING btree ("identity_subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_staff_role_assignment_unrecorded_end_idx" ON "shop_staff_role_assignment" USING btree ("ends_at") WHERE "shop_staff_role_assignment"."ends_at" IS NOT NULL AND "shop_staff_role_assignment"."end_recorded_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lax_staff_role_directory" (
  "assignment_id" uuid PRIMARY KEY NOT NULL,
  "subject_id" text NOT NULL,
  "product" text NOT NULL,
  "role" text NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone,
  "granted_by_subject_id" text,
  "granted_at" timestamp with time zone NOT NULL,
  "reason" text,
  "end_recorded_at" timestamp with time zone,
  "granted_event_id" bigint,
  "ended_event_id" bigint,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lax_staff_role_directory_product" CHECK ("product" IN ('shop'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lax_staff_role_directory_subject_idx" ON "lax_staff_role_directory" USING btree ("subject_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.lax_staff_role_directory_from_shop_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public."lax_staff_role_directory" WHERE "assignment_id" = OLD."id";
    RETURN OLD;
  END IF;
  INSERT INTO public."lax_staff_role_directory" (
    "assignment_id", "subject_id", "product", "role", "starts_at", "ends_at",
    "granted_by_subject_id", "granted_at", "reason", "end_recorded_at",
    "granted_event_id", "ended_event_id", "updated_at"
  )
  VALUES (
    NEW."id", NEW."identity_subject_id", 'shop', NEW."role"::text, NEW."starts_at", NEW."ends_at",
    NEW."granted_by_subject_id", NEW."granted_at", NEW."reason", NEW."end_recorded_at",
    NEW."granted_event_id", NEW."ended_event_id", now()
  )
  ON CONFLICT ("assignment_id") DO UPDATE SET
    "subject_id" = EXCLUDED."subject_id",
    "role" = EXCLUDED."role",
    "starts_at" = EXCLUDED."starts_at",
    "ends_at" = EXCLUDED."ends_at",
    "granted_by_subject_id" = EXCLUDED."granted_by_subject_id",
    "granted_at" = EXCLUDED."granted_at",
    "reason" = EXCLUDED."reason",
    "end_recorded_at" = EXCLUDED."end_recorded_at",
    "granted_event_id" = EXCLUDED."granted_event_id",
    "ended_event_id" = EXCLUDED."ended_event_id",
    "updated_at" = EXCLUDED."updated_at";
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lax_staff_role_directory_from_shop_assignment() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lax_staff_role_directory_shop_assignment ON public."shop_staff_role_assignment";
--> statement-breakpoint
CREATE TRIGGER lax_staff_role_directory_shop_assignment
AFTER INSERT OR DELETE OR UPDATE ON public."shop_staff_role_assignment"
FOR EACH ROW EXECUTE FUNCTION public.lax_staff_role_directory_from_shop_assignment();
--> statement-breakpoint
-- Every active staff member keeps the role they hold today, counted from when they joined so it
-- is in force the moment the release starts. Catalogue editors also get Editor, which now holds
-- the editorial work their role gave them.
INSERT INTO "shop_staff_role_assignment" ("identity_subject_id", "role", "starts_at", "granted_by_subject_id", "granted_at", "reason")
SELECT m."identity_subject_id", m."role", m."created_at", NULL, now(), 'migrated from single role'
FROM "shop_staff_member" m
WHERE m."disabled_at" IS NULL
ON CONFLICT ("identity_subject_id", "role") WHERE "ends_at" IS NULL DO NOTHING;
--> statement-breakpoint
INSERT INTO "shop_staff_role_assignment" ("identity_subject_id", "role", "starts_at", "granted_by_subject_id", "granted_at", "reason")
SELECT m."identity_subject_id", 'editor', m."created_at", NULL, now(), 'editorial work moved from catalogue editor'
FROM "shop_staff_member" m
WHERE m."disabled_at" IS NULL AND m."role" = 'catalogue_editor'
ON CONFLICT ("identity_subject_id", "role") WHERE "ends_at" IS NULL DO NOTHING;
--> statement-breakpoint
-- Staff are told in the product when someone changes their roles.
ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;
--> statement-breakpoint
ALTER TABLE notification
  ADD CONSTRAINT notification_type_check CHECK (
    type IN (
      'outbid',
      'lot_cancelled',
      'lot_won',
      'lot_lost',
      'lot_ending_soon',
      'watchlist_starting',
      'watchlist_ending_soon',
      'payment_received',
      'payment_due',
      'lot_ended_seller',
      'kyc_resubmission_required',
      'submission_received_for_review',
      'submission_approved',
      'submission_rejected',
      'submission_converted',
      'submission_draft_reminder',
      'submission_changes_requested',
      'consignment_agreement_reminder',
      'consignment_update',
      'condition_report_ready',
      'condition_report_declined',
      'source_of_funds_documents_requested',
      'source_of_funds_approved',
      'source_of_funds_rejected',
      'staff_role_expired',
      'staff_role_expired_admin',
      'staff_role_changed',
      'staff_role_changed_admin'
    )
  );
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_app') THEN
    GRANT SELECT ON TABLE public.lax_staff_role_directory TO api_app;
  END IF;
END
$$;
