DROP TRIGGER IF EXISTS lax_staff_access_directory_shop_staff ON public."shop_staff_member";
DROP TRIGGER IF EXISTS lax_staff_access_directory_bid_profile ON public."bid_user_profile";
DROP FUNCTION IF EXISTS public.lax_staff_access_directory_from_shop_staff();
DROP FUNCTION IF EXISTS public.lax_staff_access_directory_from_bid_profile();
DROP FUNCTION IF EXISTS public.lax_staff_access_directory_sync(text, text, text);
DROP TABLE IF EXISTS "lax_staff_access_directory";
