-- Rollback: contract user identity-only (0153_contract_user_identity_only.sql)
ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS "first_name" text,
  ADD COLUMN IF NOT EXISTS "last_name" text,
  ADD COLUMN IF NOT EXISTS "mobile" text,
  ADD COLUMN IF NOT EXISTS "mobile_country" text,
  ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'client' NOT NULL,
  ADD COLUMN IF NOT EXISTS "staff_role" "user_staff_role",
  ADD COLUMN IF NOT EXISTS "email_status" text DEFAULT 'ok' NOT NULL,
  ADD COLUMN IF NOT EXISTS "email_status_changed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "suspended_reason" text,
  ADD COLUMN IF NOT EXISTS "kyc_status" "user_kyc_status" DEFAULT 'unverified' NOT NULL,
  ADD COLUMN IF NOT EXISTS "current_kyc_session_id" text,
  ADD COLUMN IF NOT EXISTS "kyc_retry_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "kyc_verified_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "preferred_paddle_number" integer,
  ADD COLUMN IF NOT EXISTS "aml_hold_status" "user_aml_hold_status" DEFAULT 'none' NOT NULL,
  ADD COLUMN IF NOT EXISTS "aml_hold_reason" text,
  ADD COLUMN IF NOT EXISTS "aml_hold_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "signup_persona" text,
  ADD COLUMN IF NOT EXISTS "category_interests_onboarding_completed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "date_of_birth" date,
  ADD COLUMN IF NOT EXISTS "has_seen_acting_context_tooltip" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE public."user" u
SET
  "first_name" = p."first_name",
  "last_name" = p."last_name",
  "mobile" = p."mobile",
  "mobile_country" = p."mobile_country",
  "role" = p."role",
  "staff_role" = p."staff_role",
  "email_status" = p."email_status",
  "email_status_changed_at" = p."email_status_changed_at",
  "suspended_at" = p."suspended_at",
  "suspended_reason" = p."suspended_reason",
  "kyc_status" = p."kyc_status",
  "current_kyc_session_id" = p."current_kyc_session_id",
  "kyc_retry_count" = p."kyc_retry_count",
  "kyc_verified_at" = p."kyc_verified_at",
  "preferred_paddle_number" = p."preferred_paddle_number",
  "aml_hold_status" = p."aml_hold_status",
  "aml_hold_reason" = p."aml_hold_reason",
  "aml_hold_at" = p."aml_hold_at",
  "signup_persona" = p."signup_persona",
  "category_interests_onboarding_completed_at" =
    p."category_interests_onboarding_completed_at",
  "date_of_birth" = p."date_of_birth",
  "has_seen_acting_context_tooltip" = p."has_seen_acting_context_tooltip"
FROM public.bid_user_profile p
WHERE p."user_id" = u."id";
--> statement-breakpoint
ALTER TABLE public.user_category_interest
  DROP CONSTRAINT IF EXISTS "user_category_interest_user_id_fkey";
--> statement-breakpoint
ALTER TABLE public.user_category_interest
  ADD CONSTRAINT "user_category_interest_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES public."user"("id")
  ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE public.bid_user_profile
  DROP COLUMN IF EXISTS "category_interests_onboarding_completed_at";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_active_idx"
  ON public."user" ("role")
  WHERE "suspended_at" IS NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.sync_bid_profile_legacy_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  UPDATE public."user"
  SET
    "role" = NEW."role",
    "staff_role" = NEW."staff_role",
    "email_status" = NEW."email_status",
    "email_status_changed_at" = NEW."email_status_changed_at",
    "suspended_at" = NEW."suspended_at",
    "suspended_reason" = NEW."suspended_reason",
    "kyc_status" = NEW."kyc_status",
    "current_kyc_session_id" = NEW."current_kyc_session_id",
    "kyc_retry_count" = NEW."kyc_retry_count",
    "kyc_verified_at" = NEW."kyc_verified_at",
    "preferred_paddle_number" = NEW."preferred_paddle_number",
    "aml_hold_status" = NEW."aml_hold_status",
    "aml_hold_reason" = NEW."aml_hold_reason",
    "aml_hold_at" = NEW."aml_hold_at",
    "signup_persona" = NEW."signup_persona",
    "date_of_birth" = NEW."date_of_birth",
    "first_name" = NEW."first_name",
    "last_name" = NEW."last_name",
    "mobile" = NEW."mobile",
    "mobile_country" = NEW."mobile_country",
    "has_seen_acting_context_tooltip" = NEW."has_seen_acting_context_tooltip"
  WHERE "id" = NEW."user_id";
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.sync_bid_profile_legacy_user() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS bid_profile_legacy_user_sync ON public.bid_user_profile;
--> statement-breakpoint
CREATE TRIGGER bid_profile_legacy_user_sync
AFTER INSERT OR UPDATE OF
  "role",
  "staff_role",
  "email_status",
  "email_status_changed_at",
  "suspended_at",
  "suspended_reason",
  "kyc_status",
  "current_kyc_session_id",
  "kyc_retry_count",
  "kyc_verified_at",
  "preferred_paddle_number",
  "aml_hold_status",
  "aml_hold_reason",
  "aml_hold_at",
  "signup_persona",
  "date_of_birth",
  "first_name",
  "last_name",
  "mobile",
  "mobile_country",
  "has_seen_acting_context_tooltip"
ON public.bid_user_profile
FOR EACH ROW
EXECUTE FUNCTION public.sync_bid_profile_legacy_user();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.sync_legacy_auth_mobile_to_bid_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  UPDATE public.bid_user_profile
  SET
    "mobile" = NEW."mobile",
    "mobile_country" = NEW."mobile_country",
    "updated_at" = NEW."updated_at"
  WHERE "user_id" = NEW."id";
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.sync_legacy_auth_mobile_to_bid_profile() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS legacy_auth_mobile_bid_profile_sync ON public."user";
--> statement-breakpoint
CREATE TRIGGER legacy_auth_mobile_bid_profile_sync
AFTER UPDATE OF "mobile", "mobile_country"
ON public."user"
FOR EACH ROW
WHEN (
  OLD."mobile" IS DISTINCT FROM NEW."mobile"
  OR OLD."mobile_country" IS DISTINCT FROM NEW."mobile_country"
)
EXECUTE FUNCTION public.sync_legacy_auth_mobile_to_bid_profile();
