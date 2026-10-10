-- Identity-side access markers + two-step verification policy (see D35 in docs/architecture/02-decisions.md).
-- Markers record only that a subject holds staff/org access, never the role. Product role
-- tables keep them in sync through SECURITY DEFINER triggers so every write path (API,
-- worker, CLI) is covered without granting product roles access to Identity tables.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "social_auth_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_access_marker" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "product" text,
  "legal_entity_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "identity_access_marker_shape" CHECK (
    ("kind" = 'staff' AND "product" IN ('bid', 'shop') AND "legal_entity_id" IS NULL)
    OR ("kind" = 'org_member' AND "product" IS NULL AND "legal_entity_id" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_access_marker_staff_uidx"
  ON "identity_access_marker" ("subject_id", "product") WHERE "kind" = 'staff';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_access_marker_org_uidx"
  ON "identity_access_marker" ("subject_id", "legal_entity_id") WHERE "kind" = 'org_member';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_access_marker_subject_idx" ON "identity_access_marker" ("subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_access_marker_org_idx" ON "identity_access_marker" ("legal_entity_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_mfa_policy" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope" text NOT NULL,
  "legal_entity_id" uuid,
  "required" boolean NOT NULL,
  "set_by_subject_id" text,
  "set_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "identity_mfa_policy_shape" CHECK (
    ("scope" = 'staff' AND "legal_entity_id" IS NULL)
    OR ("scope" = 'org' AND "legal_entity_id" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_mfa_policy_staff_uidx"
  ON "identity_mfa_policy" ("scope") WHERE "scope" = 'staff';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_mfa_policy_org_uidx"
  ON "identity_mfa_policy" ("legal_entity_id") WHERE "scope" = 'org';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.identity_access_marker_sync_staff(p_subject text, p_product text, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_subject IS NULL THEN
    RETURN;
  END IF;
  IF p_active THEN
    INSERT INTO public."identity_access_marker" ("subject_id", "kind", "product")
    SELECT p_subject, 'staff', p_product
    WHERE EXISTS (SELECT 1 FROM public."user" WHERE "id" = p_subject)
    ON CONFLICT ("subject_id", "product") WHERE "kind" = 'staff' DO NOTHING;
  ELSE
    DELETE FROM public."identity_access_marker"
    WHERE "subject_id" = p_subject AND "kind" = 'staff' AND "product" = p_product;
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.identity_access_marker_sync_staff(text, text, boolean) FROM PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.identity_access_marker_from_bid_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.identity_access_marker_sync_staff(OLD."user_id", 'bid', false);
    RETURN OLD;
  END IF;
  PERFORM public.identity_access_marker_sync_staff(NEW."user_id", 'bid', NEW."role" = 'staff');
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.identity_access_marker_from_bid_profile() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS identity_access_marker_bid_profile ON public."bid_user_profile";
--> statement-breakpoint
CREATE TRIGGER identity_access_marker_bid_profile
AFTER INSERT OR DELETE OR UPDATE OF "role" ON public."bid_user_profile"
FOR EACH ROW EXECUTE FUNCTION public.identity_access_marker_from_bid_profile();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.identity_access_marker_from_shop_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.identity_access_marker_sync_staff(OLD."identity_subject_id", 'shop', false);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."identity_subject_id" IS DISTINCT FROM NEW."identity_subject_id" THEN
    PERFORM public.identity_access_marker_sync_staff(OLD."identity_subject_id", 'shop', false);
  END IF;
  PERFORM public.identity_access_marker_sync_staff(
    NEW."identity_subject_id", 'shop', NEW."disabled_at" IS NULL
  );
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.identity_access_marker_from_shop_staff() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS identity_access_marker_shop_staff ON public."shop_staff_member";
--> statement-breakpoint
CREATE TRIGGER identity_access_marker_shop_staff
AFTER INSERT OR DELETE OR UPDATE OF "identity_subject_id", "disabled_at" ON public."shop_staff_member"
FOR EACH ROW EXECUTE FUNCTION public.identity_access_marker_from_shop_staff();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.identity_access_marker_sync_org(p_subject text, p_legal_entity uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public."legal_entity_member" m
    JOIN public."legal_entity" e ON e."id" = m."legal_entity_id"
    WHERE m."user_id" = p_subject
      AND m."legal_entity_id" = p_legal_entity
      AND m."accepted_at" IS NOT NULL
      AND m."removed_at" IS NULL
      AND e."kind" = 'organisation'
  ) THEN
    INSERT INTO public."identity_access_marker" ("subject_id", "kind", "legal_entity_id")
    VALUES (p_subject, 'org_member', p_legal_entity)
    ON CONFLICT ("subject_id", "legal_entity_id") WHERE "kind" = 'org_member' DO NOTHING;
  ELSE
    DELETE FROM public."identity_access_marker"
    WHERE "subject_id" = p_subject AND "kind" = 'org_member' AND "legal_entity_id" = p_legal_entity;
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.identity_access_marker_sync_org(text, uuid) FROM PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.identity_access_marker_from_org_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.identity_access_marker_sync_org(OLD."user_id", OLD."legal_entity_id");
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.identity_access_marker_sync_org(NEW."user_id", NEW."legal_entity_id");
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.identity_access_marker_from_org_member() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS identity_access_marker_org_member ON public."legal_entity_member";
--> statement-breakpoint
CREATE TRIGGER identity_access_marker_org_member
AFTER INSERT OR DELETE OR UPDATE OF "user_id", "legal_entity_id", "accepted_at", "removed_at"
ON public."legal_entity_member"
FOR EACH ROW EXECUTE FUNCTION public.identity_access_marker_from_org_member();
--> statement-breakpoint
INSERT INTO "identity_access_marker" ("subject_id", "kind", "product")
SELECT p."user_id", 'staff', 'bid'
FROM "bid_user_profile" p
WHERE p."role" = 'staff'
ON CONFLICT ("subject_id", "product") WHERE "kind" = 'staff' DO NOTHING;
--> statement-breakpoint
INSERT INTO "identity_access_marker" ("subject_id", "kind", "product")
SELECT s."identity_subject_id", 'staff', 'shop'
FROM "shop_staff_member" s
JOIN "user" u ON u."id" = s."identity_subject_id"
WHERE s."disabled_at" IS NULL
ON CONFLICT ("subject_id", "product") WHERE "kind" = 'staff' DO NOTHING;
--> statement-breakpoint
INSERT INTO "identity_access_marker" ("subject_id", "kind", "legal_entity_id")
SELECT DISTINCT m."user_id", 'org_member', m."legal_entity_id"
FROM "legal_entity_member" m
JOIN "legal_entity" e ON e."id" = m."legal_entity_id"
WHERE m."accepted_at" IS NOT NULL AND m."removed_at" IS NULL AND e."kind" = 'organisation'
ON CONFLICT ("subject_id", "legal_entity_id") WHERE "kind" = 'org_member' DO NOTHING;
--> statement-breakpoint
INSERT INTO "identity_mfa_policy" ("scope", "required")
VALUES ('staff', true)
ON CONFLICT ("scope") WHERE "scope" = 'staff' DO NOTHING;
