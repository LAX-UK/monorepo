-- Hybrid Sale + Lot: backfill categories, create sale, rename auction -> lot, rename FK columns, rename auction_status -> lot_status

--> statement-breakpoint
INSERT INTO "category" ("id", "name", "slug", "parent_id")
SELECT gen_random_uuid(), 'Uncategorized', 'uncategorized', NULL
WHERE NOT EXISTS (SELECT 1 FROM "category" WHERE "slug" = 'uncategorized');
--> statement-breakpoint
UPDATE "auction" SET "category_id" = (SELECT "id" FROM "category" WHERE "slug" = 'uncategorized' LIMIT 1)
WHERE "category_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "auction" DROP CONSTRAINT IF EXISTS "auction_category_id_category_id_fk";
--> statement-breakpoint
ALTER TABLE "auction" ALTER COLUMN "category_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "auction" ADD CONSTRAINT "lot_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('draft', 'scheduled', 'active', 'ended', 'cancelled');
--> statement-breakpoint
CREATE TABLE "sale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_images" text[] DEFAULT '{}' NOT NULL,
	"category_id" uuid,
	"status" "sale_status" DEFAULT 'draft' NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"preview_start_time" timestamp with time zone,
	"buyer_premium_rate" numeric(5, 4) DEFAULT '0.25' NOT NULL,
	"terms" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sale_category_id_idx" ON "sale" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "sale_status_end_time_idx" ON "sale" USING btree ("status", "end_time");
--> statement-breakpoint
CREATE INDEX "sale_created_by_idx" ON "sale" USING btree ("created_by");
--> statement-breakpoint
ALTER TABLE "auction" ADD COLUMN "sale_id" uuid;
--> statement-breakpoint
ALTER TABLE "auction" ADD COLUMN "lot_number" integer;
--> statement-breakpoint
ALTER TABLE "auction" ADD CONSTRAINT "auction_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "payment_auction_buyer_open_unique";
--> statement-breakpoint
ALTER TABLE "auction" RENAME TO "lot";
--> statement-breakpoint
ALTER TYPE "public"."auction_status" RENAME TO "lot_status";
--> statement-breakpoint
ALTER TABLE "lot" RENAME CONSTRAINT "auction_pkey" TO "lot_pkey";
--> statement-breakpoint
ALTER TABLE "lot" RENAME CONSTRAINT "auction_seller_id_user_id_fk" TO "lot_seller_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "lot" RENAME CONSTRAINT "auction_winner_id_user_id_fk" TO "lot_winner_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "lot" RENAME CONSTRAINT "auction_end_after_start" TO "lot_end_after_start";
--> statement-breakpoint
ALTER TABLE "lot" RENAME CONSTRAINT "auction_reserve_ge_start" TO "lot_reserve_ge_start";
--> statement-breakpoint
ALTER TABLE "lot" RENAME CONSTRAINT "auction_sale_id_sale_id_fk" TO "lot_sale_id_sale_id_fk";
--> statement-breakpoint
ALTER INDEX "auction_seller_id_idx" RENAME TO "lot_seller_id_idx";
--> statement-breakpoint
ALTER INDEX "auction_category_id_idx" RENAME TO "lot_category_id_idx";
--> statement-breakpoint
ALTER INDEX "auction_status_end_time_idx" RENAME TO "lot_status_end_time_idx";
--> statement-breakpoint
CREATE INDEX "lot_sale_id_idx" ON "lot" USING btree ("sale_id");
--> statement-breakpoint
ALTER TABLE "bid" RENAME COLUMN "auction_id" TO "lot_id";
--> statement-breakpoint
ALTER INDEX "bid_auction_id_amount_idx" RENAME TO "bid_lot_id_amount_idx";
--> statement-breakpoint
ALTER TABLE "bid" RENAME CONSTRAINT "bid_auction_id_auction_id_fk" TO "bid_lot_id_lot_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" RENAME COLUMN "auction_id" TO "lot_id";
--> statement-breakpoint
ALTER INDEX "payment_auction_id_idx" RENAME TO "payment_lot_id_idx";
--> statement-breakpoint
ALTER TABLE "payment" RENAME CONSTRAINT "payment_auction_id_auction_id_fk" TO "payment_lot_id_lot_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_lot_buyer_open_unique" ON "payment" ("lot_id", "buyer_id")
  WHERE "status" IN ('pending', 'authorized', 'captured');
--> statement-breakpoint
ALTER TABLE "watchlist" DROP CONSTRAINT IF EXISTS "watchlist_user_auction_uid";
--> statement-breakpoint
ALTER TABLE "watchlist" RENAME COLUMN "auction_id" TO "lot_id";
--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_lot_uid" UNIQUE("user_id", "lot_id");
--> statement-breakpoint
ALTER TABLE "watchlist" RENAME CONSTRAINT "watchlist_auction_id_auction_id_fk" TO "watchlist_lot_id_lot_id_fk";
--> statement-breakpoint
ALTER TABLE "notification" RENAME COLUMN "auction_id" TO "lot_id";
--> statement-breakpoint
ALTER TABLE "notification" RENAME CONSTRAINT "notification_auction_id_auction_id_fk" TO "notification_lot_id_lot_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "lot_sale_id_lot_number_uid" ON "lot" ("sale_id", "lot_number") WHERE "sale_id" IS NOT NULL AND "lot_number" IS NOT NULL;
