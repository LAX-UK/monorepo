CREATE TYPE "saleroom_session_status" AS ENUM ('pending', 'live', 'paused', 'ended');

CREATE TABLE "saleroom_session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sale_id" uuid NOT NULL UNIQUE REFERENCES "sale"("id") ON DELETE CASCADE,
  "status" "saleroom_session_status" NOT NULL DEFAULT 'pending',
  "current_lot_id" uuid REFERENCES "lot"("id") ON DELETE SET NULL,
  "started_at" timestamptz,
  "ended_at" timestamptz,
  "clerk_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "auctioneer_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE "saleroom_event_kind" AS ENUM (
  'opened',
  'advanced_to_lot',
  'hammer',
  'no_sale',
  'paused',
  'resumed',
  'closed'
);

CREATE TABLE "saleroom_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "saleroom_session"("id") ON DELETE CASCADE,
  "kind" "saleroom_event_kind" NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}',
  "actor_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "occurred_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "saleroom_event_session_occurred_idx" ON "saleroom_event" ("session_id", "occurred_at");
