CREATE TABLE IF NOT EXISTS "shop_payee_connect_account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE RESTRICT,
  "stripe_platform_key" text NOT NULL,
  "stripe_connect_account_id" text NOT NULL,
  "charges_enabled" boolean DEFAULT false NOT NULL,
  "payouts_enabled" boolean DEFAULT false NOT NULL,
  "requirements_currently_due" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "disabled_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_payee_connect_account_party_platform_uid"
  ON "shop_payee_connect_account" ("party_id", "stripe_platform_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_payee_connect_account_stripe_uid"
  ON "shop_payee_connect_account" ("stripe_connect_account_id");
