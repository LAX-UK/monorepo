CREATE TYPE "public"."item_submission_status" AS ENUM(
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'withdrawn',
  'converted'
);
--> statement-breakpoint
CREATE TABLE "item_submission" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "seller_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "medium" text,
  "dimensions" text,
  "images" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "asking_price" numeric(18, 2),
  "reserve_price" numeric(18, 2),
  "category_id" uuid NOT NULL,
  "submitter_notes" text,
  "status" "item_submission_status" DEFAULT 'draft' NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "review_notes" text,
  "rejection_reason" text,
  "converted_lot_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_submission" ADD CONSTRAINT "item_submission_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_submission" ADD CONSTRAINT "item_submission_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_submission" ADD CONSTRAINT "item_submission_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_submission" ADD CONSTRAINT "item_submission_converted_lot_id_lot_id_fk" FOREIGN KEY ("converted_lot_id") REFERENCES "public"."lot"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "item_submission_seller_id_idx" ON "item_submission" USING btree ("seller_id");
--> statement-breakpoint
CREATE INDEX "item_submission_status_created_at_idx" ON "item_submission" USING btree ("status", "created_at");
--> statement-breakpoint
CREATE INDEX "item_submission_converted_lot_id_idx" ON "item_submission" USING btree ("converted_lot_id");
