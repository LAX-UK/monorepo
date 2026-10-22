-- Help centre for lax.art: categories and the questions in them. Additive only; nothing reads
-- these tables until the help routes ship, so an older shop-api is unaffected.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_help_category" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "status" "shop_editorial_status" DEFAULT 'draft' NOT NULL,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_help_category_slug_uid" ON "shop_help_category" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_help_article" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL REFERENCES "shop_help_category"("id") ON DELETE RESTRICT,
  "slug" text NOT NULL,
  "question" text NOT NULL,
  "answer_blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "answer_text" text DEFAULT '' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "status" "shop_editorial_status" DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "seo_title" text,
  "seo_description" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_help_article_slug_uid" ON "shop_help_article" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_help_article_category_idx" ON "shop_help_article" ("category_id", "position");
