-- Bidding limits for organisations. A buyer agent's authorisation can carry a total (the most the
-- agent may have committed for the organisation at once) next to its per-lot limit, and an
-- organisation can set one limit for everyone who bids for it, owners and admins included.
-- Both are empty by default, so bidding is unchanged until someone sets a limit.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "buyer_agent_authorisation" ADD COLUMN IF NOT EXISTS "total_limit" numeric(18, 2);
--> statement-breakpoint
ALTER TABLE "buyer_agent_authorisation" DROP CONSTRAINT IF EXISTS "buyer_agent_auth_total_limit_positive";
--> statement-breakpoint
ALTER TABLE "buyer_agent_authorisation"
  ADD CONSTRAINT "buyer_agent_auth_total_limit_positive"
  CHECK ("total_limit" IS NULL OR "total_limit" > 0);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_entity_bidding_limit" (
  "legal_entity_id" uuid PRIMARY KEY NOT NULL,
  "limit_amount" numeric(18, 2) NOT NULL,
  "set_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legal_entity_bidding_limit_positive" CHECK ("limit_amount" > 0),
  CONSTRAINT "legal_entity_bidding_limit_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE cascade,
  CONSTRAINT "legal_entity_bidding_limit_set_by_user_id_user_id_fk"
    FOREIGN KEY ("set_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
