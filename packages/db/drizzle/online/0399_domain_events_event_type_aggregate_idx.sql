CREATE INDEX CONCURRENTLY IF NOT EXISTS "domain_events_event_type_aggregate_id_idx"
  ON "domain_events" USING btree ("event_type", "aggregate_id");
