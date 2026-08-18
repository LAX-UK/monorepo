import type { z } from "zod";

/** Known producers that append rows to `domain_events`. */
export type DomainEventProducer = "apps/api" | "apps/auth" | "apps/worker" | "packages/db";

/** Downstream async consumers (projectors, CRM, notifications). */
export type DomainEventConsumer =
  | "zoho"
  | "xero"
  | "notifications"
  | "marketing_contacts"
  | "lot_lifecycle_snapshot"
  | "aml_match_review"
  | "source_of_funds_review"
  | "source_of_funds_documents"
  | "notification_fanout"
  | "admin_impersonation_notify"
  | "clear_artist_blocks"
  | "legal_entity_provisioning"
  | "bid_profile_provisioning"
  | "shop_identity_projection"
  | "ssf_transmitter"
  | "lot_invoice_initiation"
  | "payment_refund_notify"
  | "payout_transfer_failed_notify"
  | "lot_voided_anti_shilling"
  | "audit";

export type PiiClassification = "none" | "operational" | "contains_pii";

/** How producers should dedupe inserts for this event type. */
export type IdempotencyPolicy = "none" | "aggregate_unique" | "aggregate_event_unique";

export type DomainEventDefinition = {
  producers: DomainEventProducer[];
  consumers: DomainEventConsumer[];
  piiClassification: PiiClassification;
  idempotencyPolicy: IdempotencyPolicy;
  payloadSchemas: Readonly<Partial<Record<number, z.ZodTypeAny>>>;
};
