ALTER TABLE "category"
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "archived" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "category_archived_idx" ON "category" ("archived");
CREATE INDEX IF NOT EXISTS "category_sort_order_idx" ON "category" ("sort_order");
