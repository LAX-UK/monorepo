-- Staff triage for enquiries: a status, an assignee and a close time on both enquiry tables, an
-- append-only notes table, and the indexes the unified inbox pages through.
-- Every change is additive and defaulted, so an older shop-api keeps working. Existing rows
-- become 'new' rather than 'closed': the volume is small, and a wrongly closed enquiry would
-- silently leave the attention count while a stale 'new' one costs a single click to close.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."shop_enquiry_status" AS ENUM('new', 'in_progress', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry"
  ADD COLUMN IF NOT EXISTS "status" "shop_enquiry_status" DEFAULT 'new' NOT NULL,
  ADD COLUMN IF NOT EXISTS "assignee_subject" text,
  ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest"
  ADD COLUMN IF NOT EXISTS "status" "shop_enquiry_status" DEFAULT 'new' NOT NULL,
  ADD COLUMN IF NOT EXISTS "assignee_subject" text,
  ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry" DROP CONSTRAINT IF EXISTS "shop_general_enquiry_closed_at_ck";
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry" ADD CONSTRAINT "shop_general_enquiry_closed_at_ck"
  CHECK (("status" = 'closed') = ("closed_at" IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" DROP CONSTRAINT IF EXISTS "shop_artwork_interest_closed_at_ck";
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" ADD CONSTRAINT "shop_artwork_interest_closed_at_ck"
  CHECK (("status" = 'closed') = ("closed_at" IS NOT NULL));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_general_enquiry_inbox_idx"
  ON "shop_general_enquiry" ("status", "created_at" DESC, "id" DESC);
--> statement-breakpoint
-- Notify-me signups share this table but are not enquiries, so they stay out of the index.
CREATE INDEX IF NOT EXISTS "shop_artwork_interest_inbox_idx"
  ON "shop_artwork_interest" ("status", "created_at" DESC, "id" DESC)
  WHERE "intent" = 'enquiry';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_enquiry_note" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enquiry_kind" text NOT NULL,
  "enquiry_id" uuid NOT NULL,
  "author_subject" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_enquiry_note_kind_ck" CHECK ("enquiry_kind" IN ('general', 'artwork')),
  CONSTRAINT "shop_enquiry_note_body_ck" CHECK (char_length("body") BETWEEN 1 AND 5000)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_enquiry_note_enquiry_idx"
  ON "shop_enquiry_note" ("enquiry_kind", "enquiry_id", "created_at");
