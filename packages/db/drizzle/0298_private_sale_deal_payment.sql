-- Payments and payouts for private sale deals.
--   private_sale_deal_payment: the buyer's payment for a deal (one hosted checkout, card or bank
--     transfer, money in pence). A deal has at most one live payment: open, processing or paid.
--   private_sale_deal.invoice_reference: the invoice's reference in the finance system that issued
--     it, when one exists.
--   payout_line.private_sale_deal_id: a sale line that settles a deal instead of a lot payment. A
--     deal is settled by one sale line, and a line never names both a payment and a deal.
-- Additive: one table, two nullable columns and checks that only widen what a line may name, so
-- the running services keep working until they restart.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "private_sale_deal" ADD COLUMN IF NOT EXISTS "invoice_reference" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_sale_deal_payment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deal_id" uuid NOT NULL,
  "buyer_legal_entity_id" uuid NOT NULL,
  "created_by_user_id" text,
  "status" text DEFAULT 'open' NOT NULL,
  "rail" text NOT NULL,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "amount_minor" bigint NOT NULL,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "stripe_charge_id" text,
  "refunded_minor" bigint DEFAULT 0 NOT NULL,
  "stripe_refund_id" text,
  "paid_at" timestamp with time zone,
  "refunded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "private_sale_deal_payment_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "private_sale_deal"("id") ON DELETE RESTRICT,
  CONSTRAINT "private_sale_deal_payment_buyer_legal_entity_id_fk" FOREIGN KEY ("buyer_legal_entity_id") REFERENCES "legal_entity"("id") ON DELETE RESTRICT,
  CONSTRAINT "private_sale_deal_payment_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
  CONSTRAINT "private_sale_deal_payment_status_check" CHECK ("status" IN ('open', 'processing', 'paid', 'cancelled', 'refunded')),
  CONSTRAINT "private_sale_deal_payment_rail_check" CHECK ("rail" IN ('card', 'gb_bank_transfer')),
  CONSTRAINT "private_sale_deal_payment_currency_check" CHECK ("currency" = 'GBP'),
  CONSTRAINT "private_sale_deal_payment_amount_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "private_sale_deal_payment_refund_check" CHECK ("refunded_minor" >= 0 AND "refunded_minor" <= "amount_minor"),
  CONSTRAINT "private_sale_deal_payment_paid_check" CHECK ("status" NOT IN ('paid', 'refunded') OR "paid_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_payment_deal_idx" ON "private_sale_deal_payment" ("deal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_payment_buyer_idx" ON "private_sale_deal_payment" ("buyer_legal_entity_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_sale_deal_payment_live_uidx" ON "private_sale_deal_payment" ("deal_id") WHERE "status" IN ('open', 'processing', 'paid');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_sale_deal_payment_intent_uidx" ON "private_sale_deal_payment" ("stripe_payment_intent_id") WHERE "stripe_payment_intent_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_sale_deal_payment_charge_uidx" ON "private_sale_deal_payment" ("stripe_charge_id") WHERE "stripe_charge_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "payout_line" ADD COLUMN IF NOT EXISTS "private_sale_deal_id" uuid;
--> statement-breakpoint
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_private_sale_deal_id_fk";
--> statement-breakpoint
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_private_sale_deal_id_fk" FOREIGN KEY ("private_sale_deal_id") REFERENCES "private_sale_deal"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_payment_required";
--> statement-breakpoint
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_payment_required" CHECK (
  "kind" = 'adjustment'
  OR "kind" IN ('refund', 'dispute', 'chargeback', 'reversal')
  OR "payment_id" IS NOT NULL
  OR "private_sale_deal_id" IS NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_one_subject";
--> statement-breakpoint
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_one_subject" CHECK (
  "private_sale_deal_id" IS NULL
  OR ("payment_id" IS NULL AND "kind" = 'sale')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payout_line_sale_deal_uidx" ON "payout_line" ("private_sale_deal_id") WHERE "kind" = 'sale' AND "private_sale_deal_id" IS NOT NULL;
