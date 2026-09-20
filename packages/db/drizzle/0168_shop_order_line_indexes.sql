CREATE INDEX IF NOT EXISTS "shop_order_line_order_idx" ON "shop_order_line" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_order_subject_created_idx" ON "shop_order" USING btree ("identity_subject_id","created_at");
