CREATE TYPE "sale_registration_status" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

CREATE TABLE "sale_registration" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sale_id" uuid NOT NULL REFERENCES "sale"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "buyer_legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE RESTRICT,
  "status" "sale_registration_status" NOT NULL DEFAULT 'pending',
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "decided_at" timestamptz,
  "decided_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "bid_limit" numeric(18, 2),
  "lax_notes" text,
  "rejection_reason" text,
  CONSTRAINT "sale_registration_user_sale_entity_uid" UNIQUE ("sale_id", "user_id", "buyer_legal_entity_id")
);

CREATE INDEX "sale_registration_sale_id_status_idx" ON "sale_registration" ("sale_id", "status") WHERE "status" = 'approved';
CREATE INDEX "sale_registration_user_id_idx" ON "sale_registration" ("user_id");

CREATE TYPE "buyer_agent_authorisation_status" AS ENUM ('active', 'revoked');

CREATE TABLE "buyer_agent_authorisation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "sale_id" uuid REFERENCES "sale"("id") ON DELETE CASCADE,
  "bid_limit" numeric(18, 2),
  "valid_from" timestamptz NOT NULL DEFAULT now(),
  "valid_until" timestamptz,
  "status" "buyer_agent_authorisation_status" NOT NULL DEFAULT 'active',
  "created_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "revoked_at" timestamptz,
  "revoked_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "buyer_agent_auth_entity_user_active_idx" ON "buyer_agent_authorisation" ("legal_entity_id", "user_id") WHERE "status" = 'active';
CREATE INDEX "buyer_agent_auth_sale_idx" ON "buyer_agent_authorisation" ("sale_id") WHERE "sale_id" IS NOT NULL;
