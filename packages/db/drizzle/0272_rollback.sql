-- Rollback for 0272_kyc_retention_tombstone. Disable KYC_RETENTION_PURGE_ENABLED and roll back the
-- worker first: the previous release does not write this table. The tombstones are lost; the
-- purged records themselves are not restored.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "kyc_retention_tombstone";
