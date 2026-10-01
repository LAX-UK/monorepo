-- Keeps legacy shop_edition.status in sync with listing_status/custody_status for rolling deploys.
-- Column drop deferred to a later contract release (see docs/runbooks/shop-v1-phase-gates.md).
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "shop_edition_sync_legacy_status"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  listing_or_custody_changed boolean;
  status_changed boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    listing_or_custody_changed :=
      NEW."listing_status" IS DISTINCT FROM OLD."listing_status"
      OR NEW."custody_status" IS DISTINCT FROM OLD."custody_status";
    status_changed := NEW."status" IS DISTINCT FROM OLD."status";

    IF listing_or_custody_changed THEN
      IF NEW."listing_status" = 'sold'::"shop_edition_listing_status" THEN
        NEW."status" := 'sold';
      ELSIF NEW."listing_status" IN (
        'reserved'::"shop_edition_listing_status",
        'held'::"shop_edition_listing_status"
      ) THEN
        NEW."status" := 'reserved';
      ELSIF NEW."listing_status" = 'authorised'::"shop_edition_listing_status" THEN
        NEW."status" := 'available';
      ELSIF NEW."custody_status" = 'in_production'::"shop_edition_custody_status" THEN
        NEW."status" := 'in_production';
      ELSIF NEW."custody_status" = 'stored'::"shop_edition_custody_status" THEN
        NEW."status" := 'stored';
      ELSIF NEW."custody_status" = 'delivered'::"shop_edition_custody_status" THEN
        NEW."status" := 'shipped';
      ELSIF NEW."custody_status" = 'returned'::"shop_edition_custody_status" THEN
        NEW."status" := 'returned';
      ELSE
        NEW."status" := 'allocated';
      END IF;
      RETURN NEW;
    END IF;

    IF status_changed THEN
      NEW."listing_status" := CASE
        WHEN NEW."status" = 'sold'::"shop_edition_status" THEN 'sold'::"shop_edition_listing_status"
        WHEN NEW."status" = 'reserved'::"shop_edition_status" THEN 'reserved'::"shop_edition_listing_status"
        WHEN NEW."status" = 'available'::"shop_edition_status" THEN 'authorised'::"shop_edition_listing_status"
        ELSE 'not_authorised'::"shop_edition_listing_status"
      END;
      NEW."custody_status" := CASE
        WHEN NEW."status" = 'in_production'::"shop_edition_status" THEN 'in_production'::"shop_edition_custody_status"
        WHEN NEW."status" = 'stored'::"shop_edition_status" THEN 'stored'::"shop_edition_custody_status"
        WHEN NEW."status" = 'shipped'::"shop_edition_status" THEN 'delivered'::"shop_edition_custody_status"
        WHEN NEW."status" = 'returned'::"shop_edition_status" THEN 'returned'::"shop_edition_custody_status"
        ELSE 'unprinted'::"shop_edition_custody_status"
      END;
      RETURN NEW;
    END IF;

    RETURN NEW;
  END IF;

  -- INSERT: prefer legacy status when only status is non-default; otherwise derive status from axes.
  IF NEW."status" IS DISTINCT FROM 'allocated'::"shop_edition_status"
    AND NEW."listing_status" = 'not_authorised'::"shop_edition_listing_status"
    AND NEW."custody_status" = 'unprinted'::"shop_edition_custody_status" THEN
    NEW."listing_status" := CASE
      WHEN NEW."status" = 'sold'::"shop_edition_status" THEN 'sold'::"shop_edition_listing_status"
      WHEN NEW."status" = 'reserved'::"shop_edition_status" THEN 'reserved'::"shop_edition_listing_status"
      WHEN NEW."status" = 'available'::"shop_edition_status" THEN 'authorised'::"shop_edition_listing_status"
      ELSE 'not_authorised'::"shop_edition_listing_status"
    END;
    NEW."custody_status" := CASE
      WHEN NEW."status" = 'in_production'::"shop_edition_status" THEN 'in_production'::"shop_edition_custody_status"
      WHEN NEW."status" = 'stored'::"shop_edition_status" THEN 'stored'::"shop_edition_custody_status"
      WHEN NEW."status" = 'shipped'::"shop_edition_status" THEN 'delivered'::"shop_edition_custody_status"
      WHEN NEW."status" = 'returned'::"shop_edition_status" THEN 'returned'::"shop_edition_custody_status"
      ELSE 'unprinted'::"shop_edition_custody_status"
    END;
    RETURN NEW;
  END IF;

  IF NEW."listing_status" = 'sold'::"shop_edition_listing_status" THEN
    NEW."status" := 'sold';
  ELSIF NEW."listing_status" IN (
    'reserved'::"shop_edition_listing_status",
    'held'::"shop_edition_listing_status"
  ) THEN
    NEW."status" := 'reserved';
  ELSIF NEW."listing_status" = 'authorised'::"shop_edition_listing_status" THEN
    NEW."status" := 'available';
  ELSIF NEW."custody_status" = 'in_production'::"shop_edition_custody_status" THEN
    NEW."status" := 'in_production';
  ELSIF NEW."custody_status" = 'stored'::"shop_edition_custody_status" THEN
    NEW."status" := 'stored';
  ELSIF NEW."custody_status" = 'delivered'::"shop_edition_custody_status" THEN
    NEW."status" := 'shipped';
  ELSIF NEW."custody_status" = 'returned'::"shop_edition_custody_status" THEN
    NEW."status" := 'returned';
  ELSE
    NEW."status" := 'allocated';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "shop_edition_sync_legacy_status_trg" ON "shop_edition";
--> statement-breakpoint
CREATE TRIGGER "shop_edition_sync_legacy_status_trg"
  BEFORE INSERT OR UPDATE ON "shop_edition"
  FOR EACH ROW
  EXECUTE FUNCTION "shop_edition_sync_legacy_status"();
