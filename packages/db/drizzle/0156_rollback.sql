-- Intentionally non-destructive while the 0153-contracted user schema remains
-- active. Restoring the pre-0156 body here would reference removed first_name,
-- last_name, and mobile columns and make deletion fail at runtime.
-- 0153_rollback.sql recreates the legacy columns and function together when the
-- boundary contraction itself is reversed.
SELECT 1;
