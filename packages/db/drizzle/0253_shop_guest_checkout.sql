-- Guest checkout: the guest behind an order (also a Shop lead) and the emailed link that opens a
-- guest order without an account.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_guest_customer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "phone" text,
  "marketing_consent" boolean DEFAULT false NOT NULL,
  "marketing_consent_at" timestamp with time zone,
  "marketing_consent_version" text,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_order_count" integer DEFAULT 0 NOT NULL,
  "first_paid_at" timestamp with time zone,
  "claimed_subject_id" text,
  "claimed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_guest_customer_email_normalised_ck" CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "shop_guest_customer_paid_count_ck" CHECK ("paid_order_count" >= 0),
  CONSTRAINT "shop_guest_customer_consent_record_ck" CHECK (
    NOT "marketing_consent"
    OR ("marketing_consent_at" IS NOT NULL AND "marketing_consent_version" IS NOT NULL)
  ),
  CONSTRAINT "shop_guest_customer_claim_pair_ck"
    CHECK (("claimed_subject_id" IS NULL) = ("claimed_at" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_guest_customer_email_uid" ON "shop_guest_customer" ("email");
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "guest_customer_id" uuid
  REFERENCES "shop_guest_customer"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_order_guest_customer_idx"
  ON "shop_order" ("guest_customer_id")
  WHERE "guest_customer_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_guest_order_link" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "shop_order"("id") ON DELETE CASCADE,
  "purpose" text DEFAULT 'order_view' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "last_opened_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_guest_order_link_purpose_ck" CHECK ("purpose" IN ('order_view'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_guest_order_link_order_idx" ON "shop_guest_order_link" ("order_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_projection_cursor" (
  "name" text PRIMARY KEY NOT NULL,
  "last_event_id" bigint DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
