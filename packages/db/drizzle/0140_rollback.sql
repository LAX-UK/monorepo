DROP TRIGGER IF EXISTS legacy_auth_mobile_bid_profile_sync ON public."user";
DROP FUNCTION IF EXISTS public.sync_legacy_auth_mobile_to_bid_profile();
DROP TRIGGER IF EXISTS bid_profile_legacy_user_sync ON public."bid_user_profile";
DROP FUNCTION IF EXISTS public.sync_bid_profile_legacy_user();
DROP INDEX IF EXISTS public."bid_user_profile_kyc_status_idx";
DROP INDEX IF EXISTS public."bid_user_profile_role_active_idx";
