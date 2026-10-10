-- D36: cross-product staff access read model. Each product's role table maintains its
-- own rows through SECURITY DEFINER triggers, so Bid can show Shop roles without
-- reading Shop tables and Shop never writes Bid tables.
CREATE TABLE IF NOT EXISTS "lax_staff_access_directory" (
  "subject_id" text NOT NULL,
  "product" text NOT NULL,
  "role" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lax_staff_access_directory_pk" PRIMARY KEY ("subject_id", "product"),
  CONSTRAINT "lax_staff_access_directory_product" CHECK ("product" IN ('bid', 'shop'))
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.lax_staff_access_directory_sync(p_subject text, p_product text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_subject IS NULL THEN
    RETURN;
  END IF;
  IF p_role IS NULL THEN
    DELETE FROM public."lax_staff_access_directory"
    WHERE "subject_id" = p_subject AND "product" = p_product;
    RETURN;
  END IF;
  INSERT INTO public."lax_staff_access_directory" ("subject_id", "product", "role", "updated_at")
  VALUES (p_subject, p_product, p_role, now())
  ON CONFLICT ("subject_id", "product") DO UPDATE
  SET "role" = EXCLUDED."role", "updated_at" = EXCLUDED."updated_at"
  WHERE public."lax_staff_access_directory"."role" IS DISTINCT FROM EXCLUDED."role";
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lax_staff_access_directory_sync(text, text, text) FROM PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.lax_staff_access_directory_from_bid_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.lax_staff_access_directory_sync(OLD."user_id", 'bid', NULL);
    RETURN OLD;
  END IF;
  PERFORM public.lax_staff_access_directory_sync(
    NEW."user_id",
    'bid',
    CASE WHEN NEW."role" = 'staff' THEN COALESCE(NEW."staff_role"::text, 'staff') END
  );
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lax_staff_access_directory_from_bid_profile() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lax_staff_access_directory_bid_profile ON public."bid_user_profile";
--> statement-breakpoint
CREATE TRIGGER lax_staff_access_directory_bid_profile
AFTER INSERT OR DELETE OR UPDATE OF "role", "staff_role" ON public."bid_user_profile"
FOR EACH ROW EXECUTE FUNCTION public.lax_staff_access_directory_from_bid_profile();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.lax_staff_access_directory_from_shop_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.lax_staff_access_directory_sync(OLD."identity_subject_id", 'shop', NULL);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."identity_subject_id" IS DISTINCT FROM NEW."identity_subject_id" THEN
    PERFORM public.lax_staff_access_directory_sync(OLD."identity_subject_id", 'shop', NULL);
  END IF;
  PERFORM public.lax_staff_access_directory_sync(
    NEW."identity_subject_id",
    'shop',
    CASE WHEN NEW."disabled_at" IS NULL THEN NEW."role"::text END
  );
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lax_staff_access_directory_from_shop_staff() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lax_staff_access_directory_shop_staff ON public."shop_staff_member";
--> statement-breakpoint
CREATE TRIGGER lax_staff_access_directory_shop_staff
AFTER INSERT OR DELETE OR UPDATE OF "identity_subject_id", "role", "disabled_at" ON public."shop_staff_member"
FOR EACH ROW EXECUTE FUNCTION public.lax_staff_access_directory_from_shop_staff();
--> statement-breakpoint
INSERT INTO "lax_staff_access_directory" ("subject_id", "product", "role")
SELECT p."user_id", 'bid', COALESCE(p."staff_role"::text, 'staff')
FROM "bid_user_profile" p
WHERE p."role" = 'staff'
ON CONFLICT ("subject_id", "product") DO NOTHING;
--> statement-breakpoint
INSERT INTO "lax_staff_access_directory" ("subject_id", "product", "role")
SELECT s."identity_subject_id", 'shop', s."role"::text
FROM "shop_staff_member" s
WHERE s."disabled_at" IS NULL AND s."identity_subject_id" IS NOT NULL
ON CONFLICT ("subject_id", "product") DO NOTHING;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_app') THEN
    GRANT SELECT ON TABLE public.lax_staff_access_directory TO api_app;
  END IF;
END
$$;
