CREATE TABLE IF NOT EXISTS "shop_artwork_interest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "artwork_id" uuid NOT NULL,
  "identity_subject_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "notified_at" timestamp with time zone,
  CONSTRAINT "shop_artwork_interest_artwork_id_shop_artwork_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."shop_artwork"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_interest_artwork_subject_uid" ON "shop_artwork_interest" USING btree ("artwork_id","identity_subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artwork_interest_subject_idx" ON "shop_artwork_interest" USING btree ("identity_subject_id");
