/** Shared dead-letter queue for exhausted retries (not a per-queue `-dlq` suffix). */
export const DEAD_LETTER_QUEUE_NAME = "dead-letter" as const;

export const LOT_LIFECYCLE_QUEUE_NAME = "lot-lifecycle" as const;
export const EMAIL_QUEUE_NAME = "email" as const;
export const VALIDATE_UPLOAD_QUEUE_NAME = "validate-upload" as const;
export const PROCESS_IMAGE_QUEUE_NAME = "process-image" as const;
export const IMAGE_CLEANUP_QUEUE_NAME = "image-cleanup" as const;
export const MARKETING_SYNC_QUEUE_NAME = "marketing-sync" as const;
export const MARKETING_EVENTS_QUEUE_NAME = "marketing-events" as const;
export const MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME = "marketing-events-capi-batch" as const;
export const MARKETING_OUTBOX_POLLER_QUEUE_NAME = "marketing-outbox-poller" as const;
export const PURGE_MARKETING_CLICK_IDS_QUEUE_NAME = "purge-marketing-click-ids" as const;
export const QR_CODE_SCAN_QUEUE_NAME = "qr-code-scan" as const;
export const PURGE_QR_CODE_SCANS_QUEUE_NAME = "purge-qr-code-scans" as const;
export const WEBHOOK_EVENTS_QUEUE_NAME = "webhook-events" as const;
export const GC_PENDING_UPLOADS_QUEUE_NAME = "gc-pending-uploads" as const;
export const IMPERSONATION_SWEEPER_QUEUE_NAME = "impersonation-sweeper" as const;
export const PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME = "purge-expired-verifications" as const;
export const PURGE_SOFT_DELETED_USERS_QUEUE_NAME = "purge-soft-deleted-users" as const;
export const PAYOUT_SETTLEMENT_QUEUE_NAME = "payout-settlement" as const;
export const PAYOUT_STATEMENTS_QUEUE_NAME = "payout-statements" as const;
export const LEGAL_ENTITY_ARCHIVE_QUEUE_NAME = "legal-entity-archive" as const;
export const DATA_EXPORT_QUEUE_NAME = "data-export" as const;
