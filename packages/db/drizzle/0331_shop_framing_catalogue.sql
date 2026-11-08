-- The framing catalogue: ready-made framing options (frame, mount, glazing) LAX Shop can offer on
-- editions, with a price per size band and a lead time.
--   shop_framing_option            one row per option; draft until first offered, then active or paused.
--   shop_framing_option_price      pence including VAT for each option and size band, and whether
--                                  that price is still the launch placeholder (is_placeholder).
--   shop_framing_edition_offer     an edition offering an option, with an optional price for that edition.
-- The four launch options are seeded as drafts with a placeholder price in every band. An option
-- cannot be active while any of its bands is a placeholder: staff replace each price, or confirm
-- it as right, in LAX Admin first. Triggers hold that rule in the database whatever writes the
-- rows. Additive: new tables only; the running release neither reads nor writes them.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_framing_option" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "frame" text NOT NULL,
  "mount" text NOT NULL,
  "glazing" text NOT NULL,
  "hanging" text NOT NULL,
  "lead_time_min_days" integer NOT NULL,
  "lead_time_max_days" integer NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_framing_option_code_unique" UNIQUE ("code"),
  CONSTRAINT "shop_framing_option_frame_ck" CHECK ("frame" IN ('black_wood', 'white_wood', 'natural_oak')),
  CONSTRAINT "shop_framing_option_mount_ck" CHECK ("mount" IN ('window_conservation', 'float_conservation')),
  CONSTRAINT "shop_framing_option_glazing_ck" CHECK ("glazing" IN ('uv_acrylic')),
  CONSTRAINT "shop_framing_option_hanging_ck" CHECK ("hanging" IN ('d_rings_cord')),
  CONSTRAINT "shop_framing_option_status_ck" CHECK ("status" IN ('draft', 'active', 'paused')),
  CONSTRAINT "shop_framing_option_lead_time_ck" CHECK ("lead_time_min_days" >= 1 AND "lead_time_max_days" >= "lead_time_min_days")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_framing_option_status_idx" ON "shop_framing_option" ("status", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_framing_option_price" (
  "option_id" uuid NOT NULL,
  "band" text NOT NULL,
  "price_pence" integer NOT NULL,
  "is_placeholder" boolean DEFAULT false NOT NULL,
  CONSTRAINT "shop_framing_option_price_option_id_band_pk" PRIMARY KEY ("option_id", "band"),
  CONSTRAINT "shop_framing_option_price_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "shop_framing_option" ("id") ON DELETE CASCADE,
  CONSTRAINT "shop_framing_option_price_band_ck" CHECK ("band" IN ('up_to_40x50', 'up_to_60x80', 'up_to_80x100')),
  CONSTRAINT "shop_framing_option_price_positive_ck" CHECK ("price_pence" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_framing_edition_offer" (
  "option_id" uuid NOT NULL,
  "artwork_id" uuid NOT NULL,
  "price_override_pence" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_framing_edition_offer_option_id_artwork_id_pk" PRIMARY KEY ("option_id", "artwork_id"),
  CONSTRAINT "shop_framing_edition_offer_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "shop_framing_option" ("id") ON DELETE RESTRICT,
  CONSTRAINT "shop_framing_edition_offer_artwork_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "shop_artwork" ("id") ON DELETE CASCADE,
  CONSTRAINT "shop_framing_edition_offer_override_ck" CHECK ("price_override_pence" IS NULL OR "price_override_pence" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_framing_edition_offer_artwork_idx" ON "shop_framing_edition_offer" ("artwork_id");
--> statement-breakpoint
-- Launch options: drafts with placeholder prices, replaced or confirmed by staff before any option is offered.
INSERT INTO "shop_framing_option"
  ("code", "name", "frame", "mount", "glazing", "hanging", "lead_time_min_days", "lead_time_max_days", "status", "sort_order")
VALUES
  ('black-wood', 'Black wood frame', 'black_wood', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 10, 15, 'draft', 10),
  ('white-wood', 'White wood frame', 'white_wood', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 10, 15, 'draft', 20),
  ('natural-oak', 'Natural oak frame', 'natural_oak', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 10, 15, 'draft', 30),
  ('natural-oak-float', 'Natural oak, float mount', 'natural_oak', 'float_conservation', 'uv_acrylic', 'd_rings_cord', 15, 20, 'draft', 40)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "shop_framing_option_price" ("option_id", "band", "price_pence", "is_placeholder")
SELECT o."id", v."band", v."price_pence", true
FROM "shop_framing_option" o
JOIN (VALUES
  ('black-wood', 'up_to_40x50', 12000),
  ('black-wood', 'up_to_60x80', 19500),
  ('black-wood', 'up_to_80x100', 26000),
  ('white-wood', 'up_to_40x50', 12000),
  ('white-wood', 'up_to_60x80', 19500),
  ('white-wood', 'up_to_80x100', 26000),
  ('natural-oak', 'up_to_40x50', 14000),
  ('natural-oak', 'up_to_60x80', 22500),
  ('natural-oak', 'up_to_80x100', 29500),
  ('natural-oak-float', 'up_to_40x50', 16500),
  ('natural-oak-float', 'up_to_60x80', 26000),
  ('natural-oak-float', 'up_to_80x100', 34000)
) AS v("code", "band", "price_pence") ON v."code" = o."code"
ON CONFLICT ("option_id", "band") DO NOTHING;
--> statement-breakpoint
-- An option cannot be active while any band's price is a placeholder, whichever row changes last.
CREATE OR REPLACE FUNCTION "shop_framing_no_placeholder_offer"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'shop_framing_option' THEN
    IF NEW."status" = 'active' AND EXISTS (
      SELECT 1 FROM "shop_framing_option_price" p
      WHERE p."option_id" = NEW."id" AND p."is_placeholder"
    ) THEN
      RAISE EXCEPTION 'shop_framing_option_placeholder_not_offered_ck: framing option % cannot be offered while a price is a placeholder', NEW."id"
        USING ERRCODE = 'check_violation', CONSTRAINT = 'shop_framing_option_placeholder_not_offered_ck';
    END IF;
  ELSIF NEW."is_placeholder" AND EXISTS (
    SELECT 1 FROM "shop_framing_option" o WHERE o."id" = NEW."option_id" AND o."status" = 'active'
  ) THEN
    RAISE EXCEPTION 'shop_framing_option_placeholder_not_offered_ck: framing option % is offered, so a price cannot become a placeholder', NEW."option_id"
      USING ERRCODE = 'check_violation', CONSTRAINT = 'shop_framing_option_placeholder_not_offered_ck';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "shop_framing_option_no_placeholder_offer" ON "shop_framing_option";
--> statement-breakpoint
CREATE TRIGGER "shop_framing_option_no_placeholder_offer"
  BEFORE INSERT OR UPDATE OF "status" ON "shop_framing_option"
  FOR EACH ROW EXECUTE FUNCTION "shop_framing_no_placeholder_offer"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "shop_framing_option_price_no_placeholder_offer" ON "shop_framing_option_price";
--> statement-breakpoint
CREATE TRIGGER "shop_framing_option_price_no_placeholder_offer"
  BEFORE INSERT OR UPDATE OF "is_placeholder" ON "shop_framing_option_price"
  FOR EACH ROW EXECUTE FUNCTION "shop_framing_no_placeholder_offer"();
