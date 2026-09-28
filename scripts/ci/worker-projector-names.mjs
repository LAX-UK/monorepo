/** SSOT: domain-event projector names used by the worker (must match apps/worker/src/projectors). */

export const IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR = "identity_lifecycle_outbox_relay";

export const DOMAIN_EVENT_PROJECTOR_NAMES = [
  "admin_impersonation_notify",
  "aml_match_review",
  "bid_identity_directory",
  "bid_profile_provisioning",
  "clear_artist_blocks",
  "legal_entity_provisioning",
  "lot_invoice_initiation",
  "lot_voided_anti_shilling_admin_notify",
  "marketing_contacts",
  "notification_fanout",
  "payment_refund_notify",
  "payout_transfer_failed_notify",
  "shop_identity_projection",
  "source_of_funds_document_review",
  "source_of_funds_documents",
  "source_of_funds_review",
  "source_of_funds_review_resolution",
  "xero",
  "zoho",
];

export const ALL_STAGING_PROJECTOR_NAMES = [
  ...DOMAIN_EVENT_PROJECTOR_NAMES,
  IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR,
];
