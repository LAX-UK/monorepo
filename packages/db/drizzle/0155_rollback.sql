-- Restore the checkpoint to the domain_events id space for a code rollback.
-- Settled delivery cleanup and detached legacy source ids are intentionally
-- irreversible; neither is required to resume domain_events-backed mapping.
UPDATE public.ssf_stream
SET
  last_mapped_event_id = (
    SELECT coalesce(max(id), 0)
    FROM public.domain_events
  ),
  updated_at = now();
