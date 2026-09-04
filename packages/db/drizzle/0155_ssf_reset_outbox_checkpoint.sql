-- Move SSF stream checkpoints from the domain_events id space to the
-- identity_lifecycle_outbox id space without replaying historical signals.
DELETE FROM public.ssf_delivery
WHERE status IN ('delivered', 'failed');
--> statement-breakpoint
-- Retain undelivered signed SETs, but detach their source ids from the old
-- domain_events sequence so future outbox ids cannot collide with them.
UPDATE public.ssf_delivery
SET source_event_id = NULL
WHERE source_event_id IS NOT NULL;
--> statement-breakpoint
UPDATE public.ssf_stream
SET
  last_mapped_event_id = (
    SELECT coalesce(max(id), 0)
    FROM public.identity_lifecycle_outbox
  ),
  updated_at = now();
