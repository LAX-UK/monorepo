-- Rolls back 0248. Roll back the application release first: the previous release reads the single
-- role on shop_staff_member, which this release keeps in step with each person's primary role.
-- Editors return to Catalogue editor (the role that held editorial work); a person whose only
-- role is Read-only loses LAX Admin access, which the single-role model cannot express. Second
-- roles, end dates and role-change notifications are lost.
SET LOCAL lock_timeout = '30s';

DROP TRIGGER IF EXISTS lax_staff_role_directory_shop_assignment ON public."shop_staff_role_assignment";

DROP FUNCTION IF EXISTS public.lax_staff_role_directory_from_shop_assignment();

DROP TABLE IF EXISTS "lax_staff_role_directory";

UPDATE "shop_staff_member" SET "role" = 'catalogue_editor' WHERE "role" = 'editor';

UPDATE "shop_staff_member"
SET "disabled_at" = COALESCE("disabled_at", now()), "role" = 'catalogue_editor'
WHERE "role" = 'read_only';

DROP TABLE IF EXISTS "shop_staff_role_assignment";

DROP TRIGGER IF EXISTS lax_staff_access_directory_shop_staff ON public."shop_staff_member";

ALTER TYPE "shop_staff_role" RENAME TO "shop_staff_role_multi";

CREATE TYPE "shop_staff_role" AS ENUM ('shop_admin', 'account_manager', 'broker', 'operations', 'finance', 'catalogue_editor');

ALTER TABLE "shop_staff_member"
  ALTER COLUMN "role" TYPE "shop_staff_role" USING "role"::text::"shop_staff_role";

DROP TYPE "shop_staff_role_multi";

CREATE TRIGGER lax_staff_access_directory_shop_staff
AFTER INSERT OR DELETE OR UPDATE OF "identity_subject_id", "role", "disabled_at" ON public."shop_staff_member"
FOR EACH ROW EXECUTE FUNCTION public.lax_staff_access_directory_from_shop_staff();

DELETE FROM notification WHERE type IN ('staff_role_changed', 'staff_role_changed_admin');

ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;

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
      'staff_role_expired_admin'
    )
  );
