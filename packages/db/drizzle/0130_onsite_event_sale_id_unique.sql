-- Ensures a saleroom sale can back at most one onsite event (RSVP gala / expected-guests
-- lookups assume a 1:1 link and pick the first match otherwise).
CREATE UNIQUE INDEX IF NOT EXISTS "onsite_event_sale_id_unique" ON "onsite_event" ("sale_id") WHERE "sale_id" IS NOT NULL;
