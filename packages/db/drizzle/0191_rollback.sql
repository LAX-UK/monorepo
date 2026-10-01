-- IRREVERSIBLE: reintroduces legacy shop_edition.status enum; two-axis listing/custody data cannot be faithfully restored.
CREATE TYPE "shop_edition_status" AS ENUM(
  'allocated',
  'available',
  'reserved',
  'sold',
  'in_production',
  'stored',
  'shipped',
  'returned'
);
--> statement-breakpoint
ALTER TABLE "shop_edition" ADD COLUMN IF NOT EXISTS "status" "shop_edition_status" DEFAULT 'allocated' NOT NULL;
