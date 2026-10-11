ALTER TABLE "shop_artwork"
  ADD COLUMN IF NOT EXISTS "is_personalised_goods" boolean DEFAULT false NOT NULL;
