-- Phase A: KYC session tracking, retry count, Stripe webhook idempotency (pre-SE-P24 audit fixes)

ALTER TABLE "user"
  ADD COLUMN "current_kyc_session_id" text,
  ADD COLUMN "kyc_retry_count" integer NOT NULL DEFAULT 0;

CREATE TABLE "processed_stripe_events" (
  "event_id" text PRIMARY KEY,
  "source" text NOT NULL,
  "processed_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "processed_stripe_events_source_idx"
  ON "processed_stripe_events" ("source", "processed_at");
