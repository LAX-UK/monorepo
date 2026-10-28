CREATE INDEX IF NOT EXISTS "absentee_bid_buyer_entity_scheduled_idx" ON "absentee_bid" USING btree ("buyer_legal_entity_id") WHERE "absentee_bid"."status" = 'scheduled';
