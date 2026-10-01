CREATE TYPE "shop_refund_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "shop_dispute_status" AS ENUM('opened', 'won', 'lost', 'closed');
--> statement-breakpoint
CREATE TYPE "shop_return_status" AS ENUM('requested', 'in_transit', 'received', 'cancelled');
--> statement-breakpoint
CREATE TYPE "shop_payee_compliance_status" AS ENUM('not_required', 'pending', 'verified', 'blocked');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_refund" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "shop_order"("id") ON DELETE restrict,
  "order_line_id" uuid REFERENCES "shop_order_line"("id") ON DELETE set null,
  "amount_pence" integer NOT NULL,
  "status" "shop_refund_status" DEFAULT 'pending' NOT NULL,
  "stripe_refund_id" text,
  "idempotency_key" text NOT NULL,
  "requested_by_subject_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_refund_amount_nonnegative" CHECK ("amount_pence" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_refund_idempotency_uid" ON "shop_refund" ("idempotency_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_dispute" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "shop_order"("id") ON DELETE restrict,
  "stripe_dispute_id" text NOT NULL,
  "status" "shop_dispute_status" DEFAULT 'opened' NOT NULL,
  "amount_pence" integer NOT NULL,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_dispute_amount_nonnegative" CHECK ("amount_pence" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_dispute_stripe_uid" ON "shop_dispute" ("stripe_dispute_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_return" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_line_id" uuid NOT NULL REFERENCES "shop_order_line"("id") ON DELETE restrict,
  "edition_id" uuid NOT NULL REFERENCES "shop_edition"("id") ON DELETE restrict,
  "status" "shop_return_status" DEFAULT 'requested' NOT NULL,
  "received_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_return_order_line_uid" ON "shop_return" ("order_line_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_payee_compliance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE restrict,
  "status" "shop_payee_compliance_status" DEFAULT 'not_required' NOT NULL,
  "blocked_reason" text,
  "verified_at" timestamp with time zone,
  "verified_by_subject_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_payee_compliance_party_uid" ON "shop_payee_compliance" ("party_id");
