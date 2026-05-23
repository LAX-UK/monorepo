ALTER TABLE "kyc_verification" RENAME COLUMN "stripe_verification_session_id" TO "provider_session_id";

ALTER TABLE "kyc_verification" ALTER COLUMN "provider" SET DEFAULT 'veriff';

ALTER TABLE "kyc_verification" ADD COLUMN "provider_attempt_id" text;

CREATE TABLE "processed_webhook_events" (
  "event_id" text PRIMARY KEY,
  "source" text NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "processed_webhook_events_source_idx" ON "processed_webhook_events" ("source", "processed_at");
