-- Table views a staff member saves for a list, kept per person so they follow them across
-- devices. Each tool owns its own table: Bid admin in admin_saved_view (written by apps/api),
-- LAX Admin in shop_staff_saved_view (written by apps/shop-api). The owner is the Identity
-- subject; there is no foreign key so neither table depends on another tool's user data.
-- Additive: the running services do not touch either table until they are deployed.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_saved_view" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_subject_id" text NOT NULL,
  "list_key" text NOT NULL,
  "label" text NOT NULL,
  "query" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "admin_saved_view_owner_list_label_uid" UNIQUE ("owner_subject_id", "list_key", "label")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_saved_view_owner_list_idx"
  ON "admin_saved_view" ("owner_subject_id", "list_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_staff_saved_view" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_subject_id" text NOT NULL,
  "list_key" text NOT NULL,
  "label" text NOT NULL,
  "query" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "shop_staff_saved_view_owner_list_label_uid" UNIQUE ("owner_subject_id", "list_key", "label")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_staff_saved_view_owner_list_idx"
  ON "shop_staff_saved_view" ("owner_subject_id", "list_key");
