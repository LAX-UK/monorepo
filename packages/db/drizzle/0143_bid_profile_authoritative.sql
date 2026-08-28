CREATE INDEX IF NOT EXISTS "bid_user_profile_role_active_idx"
ON public."bid_user_profile" USING btree ("role")
WHERE "suspended_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_user_profile_kyc_status_idx"
ON public."bid_user_profile" USING btree ("kyc_status");
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
DROP TRIGGER IF EXISTS bid_profile_legacy_user_sync ON public."bid_user_profile";
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
ON public."bid_user_profile"
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
  UPDATE public."bid_user_profile"
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
