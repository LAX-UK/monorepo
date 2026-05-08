-- fast filtering of impersonation audit events (event_type discriminator).
CREATE INDEX IF NOT EXISTS domain_events_impersonation_idx
ON domain_events (event_type)
WHERE event_type IN ('admin.impersonation_started', 'admin.impersonation_ended');
