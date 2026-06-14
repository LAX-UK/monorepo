ALTER TYPE "sale_delivery_mode" ADD VALUE IF NOT EXISTS 'hybrid';--> statement-breakpoint
ALTER TABLE "sale_registration" ADD COLUMN "paddle_number" integer;--> statement-breakpoint
ALTER TABLE "sale_registration" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "preferred_paddle_number" integer;--> statement-breakpoint
ALTER TABLE "bid" ADD COLUMN "clerk_user_id" text;--> statement-breakpoint
ALTER TABLE "bid" ADD CONSTRAINT "bid_clerk_user_id_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_registration_sale_paddle_uid" ON "sale_registration" USING btree ("sale_id","paddle_number");--> statement-breakpoint
CREATE INDEX "bid_clerk_user_id_idx" ON "bid" USING btree ("clerk_user_id");
