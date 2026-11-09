-- Framing on editions: how an edition is sold, and the buyer's choice in the basket.
--   shop_edition_framing              one row per edition that sells framing or says its print comes
--                                     framed: unframed with framing to choose, framed only, or framed
--                                     by the artist (with the frame in words). No row = as before.
--   shop_basket_line.framing_option_id the framing option chosen for a print in the basket, null for
--                                     unframed. Its price is worked out from the catalogue each time
--                                     the basket is read and is never taken from the buyer.
-- The free-text frame description an edition already had (shop_artwork.print_frame) becomes
-- "comes framed by the artist", with that text as the description. The old column is left as it
-- is. Additive: a new table, a nullable column and a copy of existing text; the running release
-- neither reads nor writes them.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_edition_framing" (
  "artwork_id" uuid PRIMARY KEY NOT NULL,
  "mode" text NOT NULL,
  "framed_by_artist" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_edition_framing_artwork_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "shop_artwork" ("id") ON DELETE CASCADE,
  CONSTRAINT "shop_edition_framing_mode_ck" CHECK ("mode" IN ('unframed_or_framed', 'framed_only', 'framed_by_artist')),
  CONSTRAINT "shop_edition_framing_artist_text_ck" CHECK (("mode" = 'framed_by_artist') = ("framed_by_artist" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "shop_basket_line" ADD COLUMN IF NOT EXISTS "framing_option_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shop_basket_line_framing_option_id_fk'
  ) THEN
    ALTER TABLE "shop_basket_line"
      ADD CONSTRAINT "shop_basket_line_framing_option_id_fk"
      FOREIGN KEY ("framing_option_id") REFERENCES "shop_framing_option" ("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
-- Framing belongs to a print, never to a product variant.
ALTER TABLE "shop_basket_line" DROP CONSTRAINT IF EXISTS "shop_basket_line_framing_on_print_ck";
--> statement-breakpoint
ALTER TABLE "shop_basket_line"
  ADD CONSTRAINT "shop_basket_line_framing_on_print_ck"
  CHECK ("framing_option_id" IS NULL OR "artwork_id" IS NOT NULL);
--> statement-breakpoint
-- Existing frame descriptions: one row per edition that has text, never over a row staff have set.
INSERT INTO "shop_edition_framing" ("artwork_id", "mode", "framed_by_artist")
SELECT a."id", 'framed_by_artist', btrim(a."print_frame")
FROM "shop_artwork" a
WHERE a."print_frame" IS NOT NULL AND btrim(a."print_frame") <> ''
ON CONFLICT ("artwork_id") DO NOTHING;
