ALTER TABLE "ssf_delivery"
  ADD CONSTRAINT "ssf_delivery_source_event_id_fkey"
  FOREIGN KEY ("source_event_id") REFERENCES "domain_events"("id") ON DELETE RESTRICT;
