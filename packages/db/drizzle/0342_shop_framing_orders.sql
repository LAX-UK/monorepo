-- Framing in orders. A framed print is two order lines: the print, and a framing line that points
-- at it, priced and taxed on its own and never part of what an artist or owner is paid.
--   shop_order.framing_subtotal_pence       the framing on the order, kept apart from the goods
--                                           (merchandise_subtotal_pence stays the goods alone, so
--                                           everything that reads it as the value of the work is
--                                           unchanged).
--   shop_order_line.kind                    'goods' (a print or a product) or 'framing'.
--   shop_order_line.framing_for_line_id     the print line a framing line belongs to.
--   shop_order_line.framing_option_id       the catalogue option sold.
--   shop_order_line.framing_snapshot        the option as sold; fixed once written.
--   shop_framing_task                       the work on one frame, with its due date.
--   shop_basket_line.framing_price_pence    the frame's price the shopper was shown when they chose
--                                           it; checkout refuses (price changed) when it moved.
-- A framing line has no edition, product, artwork or seller, which the replaced target check
-- spells out. Additive: existing rows are goods and keep passing.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "framing_subtotal_pence" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order" DROP CONSTRAINT IF EXISTS "shop_order_framing_subtotal_nonnegative";
--> statement-breakpoint
ALTER TABLE "shop_order"
  ADD CONSTRAINT "shop_order_framing_subtotal_nonnegative" CHECK ("framing_subtotal_pence" >= 0);
--> statement-breakpoint
ALTER TABLE "shop_basket_line" ADD COLUMN IF NOT EXISTS "framing_price_pence" integer;
--> statement-breakpoint
ALTER TABLE "shop_basket_line" DROP CONSTRAINT IF EXISTS "shop_basket_line_framing_price_ck";
--> statement-breakpoint
ALTER TABLE "shop_basket_line"
  ADD CONSTRAINT "shop_basket_line_framing_price_ck"
  CHECK ("framing_price_pence" IS NULL OR "framing_price_pence" >= 0);
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'goods' NOT NULL,
  ADD COLUMN IF NOT EXISTS "framing_for_line_id" uuid,
  ADD COLUMN IF NOT EXISTS "framing_option_id" uuid,
  ADD COLUMN IF NOT EXISTS "framing_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "shop_order_line" DROP CONSTRAINT IF EXISTS "shop_order_line_kind_ck";
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD CONSTRAINT "shop_order_line_kind_ck" CHECK ("kind" IN ('goods', 'framing'));
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_order_line_framing_for_line_id_fk') THEN
    ALTER TABLE "shop_order_line"
      ADD CONSTRAINT "shop_order_line_framing_for_line_id_fk"
      FOREIGN KEY ("framing_for_line_id") REFERENCES "shop_order_line" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_order_line_framing_option_id_fk') THEN
    ALTER TABLE "shop_order_line"
      ADD CONSTRAINT "shop_order_line_framing_option_id_fk"
      FOREIGN KEY ("framing_option_id") REFERENCES "shop_framing_option" ("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
-- A line is goods (an edition or a variant, nothing of framing) or framing (a parent print line, an
-- option and its snapshot, and none of edition, product, artwork or seller). The new check is added
-- NOT VALID (a brief lock, no scan) and then validated: VALIDATE scans the table but only takes a
-- lock that lets reads and writes carry on.
ALTER TABLE "shop_order_line" DROP CONSTRAINT IF EXISTS "shop_order_line_target_xor";
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD CONSTRAINT "shop_order_line_target_xor" CHECK (
    (
      "kind" = 'goods'
      AND (("edition_id" IS NOT NULL)::int + ("product_variant_id" IS NOT NULL)::int) = 1
      AND "framing_for_line_id" IS NULL AND "framing_option_id" IS NULL AND "framing_snapshot" IS NULL
    )
    OR (
      "kind" = 'framing'
      AND "edition_id" IS NULL AND "product_variant_id" IS NULL
      AND "artwork_id" IS NULL AND "seller_party_id" IS NULL
      AND "framing_for_line_id" IS NOT NULL AND "framing_option_id" IS NOT NULL
      AND "framing_snapshot" IS NOT NULL
    )
  ) NOT VALID;
--> statement-breakpoint
ALTER TABLE "shop_order_line" VALIDATE CONSTRAINT "shop_order_line_target_xor";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_line_framing_parent_uid"
  ON "shop_order_line" ("framing_for_line_id") WHERE "framing_for_line_id" IS NOT NULL;
--> statement-breakpoint
-- What was sold is fixed: the option, the price, the tax and the snapshot of a framing line never
-- change, a line never becomes or stops being a framing line, and a framing line is never deleted.
-- A framing line must also belong to a goods line of the same order.
CREATE OR REPLACE FUNCTION "shop_order_line_framing_fixed"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."kind" = 'framing' THEN
      RAISE EXCEPTION 'shop_order_line_framing_fixed: a framing line cannot be deleted (%)', OLD."id";
    END IF;
    RETURN OLD;
  END IF;
  IF NEW."kind" = 'framing' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "shop_order_line" p
      WHERE p."id" = NEW."framing_for_line_id" AND p."kind" = 'goods' AND p."order_id" = NEW."order_id"
    ) THEN
      RAISE EXCEPTION 'shop_order_line_framing_fixed: a framing line must belong to a goods line of the same order (%)', NEW."id";
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD."kind" = 'framing' OR NEW."kind" = 'framing') AND (
    NEW."kind" IS DISTINCT FROM OLD."kind"
    OR NEW."framing_snapshot" IS DISTINCT FROM OLD."framing_snapshot"
    OR NEW."framing_option_id" IS DISTINCT FROM OLD."framing_option_id"
    OR NEW."framing_for_line_id" IS DISTINCT FROM OLD."framing_for_line_id"
    OR NEW."unit_price_pence" IS DISTINCT FROM OLD."unit_price_pence"
    OR NEW."vat_treatment" IS DISTINCT FROM OLD."vat_treatment"
    OR NEW."vat_rate_bp" IS DISTINCT FROM OLD."vat_rate_bp"
    OR NEW."vat_pence" IS DISTINCT FROM OLD."vat_pence"
    OR NEW."order_id" IS DISTINCT FROM OLD."order_id"
  ) THEN
    RAISE EXCEPTION 'shop_order_line_framing_fixed: a framing line as sold cannot be changed (%)', OLD."id";
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "shop_order_line_framing_fixed_trg" ON "shop_order_line";
--> statement-breakpoint
CREATE TRIGGER "shop_order_line_framing_fixed_trg"
  BEFORE INSERT OR UPDATE OR DELETE ON "shop_order_line"
  FOR EACH ROW EXECUTE FUNCTION "shop_order_line_framing_fixed"();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_framing_task" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_line_id" uuid NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "assigned_to_subject_id" text,
  "framing_started_at" timestamp with time zone,
  "framed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_framing_task_order_line_uid" UNIQUE ("order_line_id"),
  CONSTRAINT "shop_framing_task_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "shop_order_line" ("id") ON DELETE RESTRICT,
  CONSTRAINT "shop_framing_task_status_ck" CHECK ("status" IN ('queued', 'framing', 'framed', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_framing_task_status_due_idx" ON "shop_framing_task" ("status", "due_at");
