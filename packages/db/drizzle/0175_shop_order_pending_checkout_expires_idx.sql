CREATE INDEX IF NOT EXISTS "shop_order_pending_checkout_expires_idx" ON "shop_order" USING btree ("status","checkout_expires_at");
