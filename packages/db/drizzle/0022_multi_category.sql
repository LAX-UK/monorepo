CREATE TABLE IF NOT EXISTS "lot_categories" (
  "lot_id" uuid NOT NULL REFERENCES "lot"("id") ON DELETE CASCADE,
  "category_id" uuid NOT NULL REFERENCES "category"("id") ON DELETE RESTRICT,
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("lot_id", "category_id")
);

CREATE INDEX IF NOT EXISTS "lot_categories_category_id_idx" ON "lot_categories" ("category_id");
CREATE INDEX IF NOT EXISTS "lot_categories_lot_id_sort_order_idx" ON "lot_categories" ("lot_id", "sort_order");

CREATE TABLE IF NOT EXISTS "sale_categories" (
  "sale_id" uuid NOT NULL REFERENCES "sale"("id") ON DELETE CASCADE,
  "category_id" uuid NOT NULL REFERENCES "category"("id") ON DELETE RESTRICT,
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("sale_id", "category_id")
);

CREATE INDEX IF NOT EXISTS "sale_categories_category_id_idx" ON "sale_categories" ("category_id");
CREATE INDEX IF NOT EXISTS "sale_categories_sale_id_sort_order_idx" ON "sale_categories" ("sale_id", "sort_order");

CREATE TABLE IF NOT EXISTS "submission_categories" (
  "submission_id" uuid NOT NULL REFERENCES "item_submission"("id") ON DELETE CASCADE,
  "category_id" uuid NOT NULL REFERENCES "category"("id") ON DELETE RESTRICT,
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("submission_id", "category_id")
);

CREATE INDEX IF NOT EXISTS "submission_categories_category_id_idx" ON "submission_categories" ("category_id");
CREATE INDEX IF NOT EXISTS "submission_categories_submission_id_sort_order_idx" ON "submission_categories" ("submission_id", "sort_order");

INSERT INTO "lot_categories" ("lot_id", "category_id", "sort_order")
SELECT "id", "category_id", 0
FROM "lot"
WHERE "category_id" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "sale_categories" ("sale_id", "category_id", "sort_order")
SELECT "id", "category_id", 0
FROM "sale"
WHERE "category_id" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "submission_categories" ("submission_id", "category_id", "sort_order")
SELECT "id", "category_id", 0
FROM "item_submission"
WHERE "category_id" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "lot" DROP COLUMN IF EXISTS "category_id";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "category_id";
ALTER TABLE "item_submission" DROP COLUMN IF EXISTS "category_id";
