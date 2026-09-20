DO $$ BEGIN
  CREATE TYPE "shop_edition_status" AS ENUM (
    'allocated',
    'available',
    'reserved',
    'sold',
    'in_production',
    'stored',
    'shipped',
    'returned'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "shop_order_status" AS ENUM (
    'pending_payment',
    'paid',
    'cancelled',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "shop_fulfilment_option" AS ENUM (
    'uk_insured_delivery',
    'collect_new_cavendish',
    'collect_brunswick',
    'lax_storage',
    'international_quotation'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "shop_payout_status" AS ENUM (
    'pending_refund_period',
    'due',
    'paid',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "shop_party" ADD COLUMN IF NOT EXISTS "identity_subject_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_party_identity_subject_uid"
  ON "shop_party" ("identity_subject_id")
  WHERE "identity_subject_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_artwork" ADD COLUMN IF NOT EXISTS "print_price_pence" integer;
--> statement-breakpoint
ALTER TABLE "shop_edition" ADD COLUMN IF NOT EXISTS "status" "shop_edition_status" DEFAULT 'allocated' NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_edition" ADD COLUMN IF NOT EXISTS "reserved_until" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_edition_sellable_idx"
  ON "shop_edition" ("artwork_id", "status", "owner_party_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_basket" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "anonymous_token_hash" text,
  "identity_subject_id" text,
  "expires_at" timestamp with time zone NOT NULL,
  "retired_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_basket_anon_hash_open_uid"
  ON "shop_basket" ("anonymous_token_hash")
  WHERE "retired_at" IS NULL AND "anonymous_token_hash" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_basket_subject_open_uid"
  ON "shop_basket" ("identity_subject_id")
  WHERE "retired_at" IS NULL AND "identity_subject_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_basket_line" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "basket_id" uuid NOT NULL,
  "artwork_id" uuid NOT NULL,
  "unit_price_pence" integer NOT NULL,
  "quantity" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_basket_line_basket_artwork_uid"
  ON "shop_basket_line" ("basket_id", "artwork_id");
--> statement-breakpoint
ALTER TABLE "shop_basket_line"
  ADD CONSTRAINT "shop_basket_line_basket_id_shop_basket_id_fk"
  FOREIGN KEY ("basket_id") REFERENCES "shop_basket"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_basket_line"
  ADD CONSTRAINT "shop_basket_line_artwork_id_shop_artwork_id_fk"
  FOREIGN KEY ("artwork_id") REFERENCES "shop_artwork"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_order" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_subject_id" text NOT NULL,
  "buyer_party_id" uuid,
  "status" "shop_order_status" DEFAULT 'pending_payment' NOT NULL,
  "fulfilment" "shop_fulfilment_option" NOT NULL,
  "merchandise_subtotal_pence" integer NOT NULL,
  "fulfilment_surcharge_pence" integer NOT NULL,
  "total_pence" integer NOT NULL,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "idempotency_key" text NOT NULL,
  "refund_period_ends_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "checkout_expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_idempotency_key_uid" ON "shop_order" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_order_subject_idx" ON "shop_order" ("identity_subject_id");
--> statement-breakpoint
ALTER TABLE "shop_order"
  ADD CONSTRAINT "shop_order_buyer_party_id_shop_party_id_fk"
  FOREIGN KEY ("buyer_party_id") REFERENCES "shop_party"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_order_line" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "edition_id" uuid NOT NULL,
  "artwork_id" uuid NOT NULL,
  "seller_party_id" uuid NOT NULL,
  "edition_number" integer NOT NULL,
  "unit_price_pence" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_line_edition_uid" ON "shop_order_line" ("edition_id");
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD CONSTRAINT "shop_order_line_order_id_shop_order_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "shop_order"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD CONSTRAINT "shop_order_line_edition_id_shop_edition_id_fk"
  FOREIGN KEY ("edition_id") REFERENCES "shop_edition"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD CONSTRAINT "shop_order_line_artwork_id_shop_artwork_id_fk"
  FOREIGN KEY ("artwork_id") REFERENCES "shop_artwork"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD CONSTRAINT "shop_order_line_seller_party_id_shop_party_id_fk"
  FOREIGN KEY ("seller_party_id") REFERENCES "shop_party"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_payout_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_line_id" uuid NOT NULL,
  "owner_party_id" uuid NOT NULL,
  "gross_pence" integer NOT NULL,
  "deductions_pence" integer DEFAULT 0 NOT NULL,
  "net_pence" integer NOT NULL,
  "payout_due_at" timestamp with time zone NOT NULL,
  "status" "shop_payout_status" DEFAULT 'pending_refund_period' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_payout_ledger_order_line_uid"
  ON "shop_payout_ledger" ("order_line_id");
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger"
  ADD CONSTRAINT "shop_payout_ledger_order_line_id_shop_order_line_id_fk"
  FOREIGN KEY ("order_line_id") REFERENCES "shop_order_line"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger"
  ADD CONSTRAINT "shop_payout_ledger_owner_party_id_shop_party_id_fk"
  FOREIGN KEY ("owner_party_id") REFERENCES "shop_party"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_processed_payment_event" (
  "event_id" text PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
