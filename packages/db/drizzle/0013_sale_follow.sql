-- User follows a saleroom (sale) for updates
CREATE TABLE IF NOT EXISTS "sale_follow" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "sale_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sale_follow_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "sale_follow_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "sale_follow_user_sale_uid" UNIQUE ("user_id","sale_id")
);

CREATE INDEX IF NOT EXISTS "sale_follow_user_id_idx" ON "sale_follow" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "sale_follow_sale_id_idx" ON "sale_follow" USING btree ("sale_id");
