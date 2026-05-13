-- Rollback: impersonation audit index on domain_events
DROP INDEX IF EXISTS domain_events_impersonation_idx;
