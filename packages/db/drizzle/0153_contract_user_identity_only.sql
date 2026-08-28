-- Phase 5: retire 0143 dual-write sync; contract `user` to Identity-only columns.
DROP TRIGGER IF EXISTS legacy_auth_mobile_bid_profile_sync ON public."user";
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.sync_legacy_auth_mobile_to_bid_profile();
--> statement-breakpoint
DROP TRIGGER IF EXISTS bid_profile_legacy_user_sync ON public.bid_user_profile;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.sync_bid_profile_legacy_user();
--> statement-breakpoint
DROP INDEX IF EXISTS public."user_role_active_idx";
--> statement-breakpoint
ALTER TABLE public.bid_user_profile
  ADD COLUMN IF NOT EXISTS "category_interests_onboarding_completed_at" timestamp with time zone;
--> statement-breakpoint
UPDATE public.bid_user_profile p
SET "category_interests_onboarding_completed_at" =
  u."category_interests_onboarding_completed_at"
FROM public."user" u
WHERE p."user_id" = u."id"
  AND p."category_interests_onboarding_completed_at" IS NULL;
--> statement-breakpoint
ALTER TABLE public.user_category_interest
  DROP CONSTRAINT IF EXISTS "user_category_interest_user_id_fkey";
--> statement-breakpoint
ALTER TABLE public.user_category_interest
  ADD CONSTRAINT "user_category_interest_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES public.bid_user_profile("user_id")
  ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE public."user"
  DROP COLUMN IF EXISTS "first_name",
  DROP COLUMN IF EXISTS "last_name",
  DROP COLUMN IF EXISTS "mobile",
  DROP COLUMN IF EXISTS "mobile_country",
  DROP COLUMN IF EXISTS "role",
  DROP COLUMN IF EXISTS "staff_role",
  DROP COLUMN IF EXISTS "email_status",
  DROP COLUMN IF EXISTS "email_status_changed_at",
  DROP COLUMN IF EXISTS "suspended_at",
  DROP COLUMN IF EXISTS "suspended_reason",
  DROP COLUMN IF EXISTS "kyc_status",
  DROP COLUMN IF EXISTS "current_kyc_session_id",
  DROP COLUMN IF EXISTS "kyc_retry_count",
  DROP COLUMN IF EXISTS "kyc_verified_at",
  DROP COLUMN IF EXISTS "preferred_paddle_number",
  DROP COLUMN IF EXISTS "aml_hold_status",
  DROP COLUMN IF EXISTS "aml_hold_reason",
  DROP COLUMN IF EXISTS "aml_hold_at",
  DROP COLUMN IF EXISTS "signup_persona",
  DROP COLUMN IF EXISTS "category_interests_onboarding_completed_at",
  DROP COLUMN IF EXISTS "date_of_birth",
  DROP COLUMN IF EXISTS "has_seen_acting_context_tooltip";
