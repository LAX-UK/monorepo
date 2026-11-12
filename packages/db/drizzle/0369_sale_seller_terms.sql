-- Seller terms: what a seller is paid for a sale, fixed when the buyer's invoice is raised.
-- One row per buyer payment. The rate comes from the lot's signed consignment agreement and is
-- charged on the hammer, with VAT on the commission; the buyer's premium stays with LAX. Nothing
-- here changes what the buyer pays: payment.platform_fee keeps its old-rule figure for now.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sale_seller_terms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_id" uuid NOT NULL,
  "lot_id" uuid NOT NULL,
  "seller_legal_entity_id" uuid NOT NULL,
  "agreement_id" uuid,
  "basis" text NOT NULL,
  "held_reason" text,
  "hammer_pence" bigint NOT NULL,
  "premium_pence" bigint NOT NULL,
  "commission_bps" integer,
  "commission_pence" bigint,
  "commission_vat_treatment" text,
  "commission_vat_bps" integer,
  "commission_vat_pence" bigint,
  "other_charges" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "seller_net_pence" bigint,
  "legacy_platform_fee_pence" bigint,
  "rule_version" text NOT NULL,
  "source" text DEFAULT 'raised' NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sale_seller_terms_payment_id_fkey" FOREIGN KEY ("payment_id")
    REFERENCES "payment"("id") ON DELETE CASCADE,
  CONSTRAINT "sale_seller_terms_lot_id_fkey" FOREIGN KEY ("lot_id")
    REFERENCES "lot"("id") ON DELETE CASCADE,
  CONSTRAINT "sale_seller_terms_seller_legal_entity_id_fkey" FOREIGN KEY ("seller_legal_entity_id")
    REFERENCES "legal_entity"("id") ON DELETE RESTRICT,
  CONSTRAINT "sale_seller_terms_agreement_id_fkey" FOREIGN KEY ("agreement_id")
    REFERENCES "consignment_agreement"("id") ON DELETE RESTRICT,
  CONSTRAINT "sale_seller_terms_basis_ck" CHECK ("basis" IN ('agreement', 'lax_owned', 'held')),
  CONSTRAINT "sale_seller_terms_held_reason_ck" CHECK (
    "held_reason" IS NULL OR "held_reason" IN (
      'no_agreement', 'not_accepted', 'no_commission', 'other_seller',
      'vat_setting_missing', 'negative_net'
    )
  ),
  CONSTRAINT "sale_seller_terms_source_ck" CHECK (
    "source" IN ('raised', 'recomputed_at_payout', 'agreement_recorded')
  ),
  CONSTRAINT "sale_seller_terms_rule_version_ck" CHECK ("rule_version" <> ''),
  CONSTRAINT "sale_seller_terms_amounts_ck" CHECK (
    "hammer_pence" >= 0 AND "premium_pence" >= 0
    AND ("legacy_platform_fee_pence" IS NULL OR "legacy_platform_fee_pence" >= 0)
  ),
  -- Charges beyond commission and VAT are reserved: none exist today, so the list is empty and the
  -- sum below is exact. A later migration that introduces them replaces this and the sum check.
  CONSTRAINT "sale_seller_terms_other_charges_ck" CHECK (
    jsonb_typeof("other_charges") = 'array' AND jsonb_array_length("other_charges") = 0
  ),
  -- One shape per basis. A sale paid on an agreement carries every figure and they add up exactly:
  -- hammer - commission - VAT - other charges = what the seller receives. LAX-owned stock and a
  -- held sale carry no agreement and no figures beyond the hammer and premium.
  CONSTRAINT "sale_seller_terms_shape_ck" CHECK (
    (
      "basis" = 'agreement'
      AND "held_reason" IS NULL
      AND "agreement_id" IS NOT NULL
      AND "commission_bps" IS NOT NULL AND "commission_bps" BETWEEN 0 AND 10000
      AND "commission_pence" IS NOT NULL AND "commission_pence" >= 0
      AND "commission_vat_treatment" IS NOT NULL
      AND "commission_vat_treatment" IN ('standard', 'not_registered')
      AND "commission_vat_bps" IS NOT NULL AND "commission_vat_bps" BETWEEN 0 AND 10000
      AND "commission_vat_pence" IS NOT NULL AND "commission_vat_pence" >= 0
      AND ("commission_vat_treatment" = 'standard' OR "commission_vat_pence" = 0)
      AND "seller_net_pence" IS NOT NULL AND "seller_net_pence" >= 0
      AND "hammer_pence" - "commission_pence" - "commission_vat_pence" = "seller_net_pence"
    )
    OR (
      "basis" IN ('lax_owned', 'held')
      AND ("basis" = 'held') = ("held_reason" IS NOT NULL)
      AND "agreement_id" IS NULL
      AND "commission_bps" IS NULL AND "commission_pence" IS NULL
      AND "commission_vat_treatment" IS NULL AND "commission_vat_bps" IS NULL
      AND "commission_vat_pence" IS NULL AND "seller_net_pence" IS NULL
    )
  )
);
--> statement-breakpoint
-- A re-awarded lot has a new payment and so a new row; each payment has exactly one.
CREATE UNIQUE INDEX IF NOT EXISTS "sale_seller_terms_payment_id_uidx"
  ON "sale_seller_terms" ("payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_seller_terms_lot_id_idx" ON "sale_seller_terms" ("lot_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_seller_terms_seller_idx"
  ON "sale_seller_terms" ("seller_legal_entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_seller_terms_held_idx"
  ON "sale_seller_terms" ("computed_at") WHERE "basis" = 'held';
--> statement-breakpoint
-- The agreement behind a sale paid to a seller says where it came from: made online by the seller,
-- or recorded by staff from a signed paper copy, with the signed file and the reason. A corrected
-- agreement points at the one it replaces.
ALTER TABLE "consignment_agreement"
  ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'online' NOT NULL,
  ADD COLUMN IF NOT EXISTS "recorded_by_user_id" text,
  ADD COLUMN IF NOT EXISTS "signed_document_id" uuid,
  ADD COLUMN IF NOT EXISTS "record_reason" text,
  ADD COLUMN IF NOT EXISTS "replaces_agreement_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consignment_agreement_recorded_by_user_id_fkey') THEN
    ALTER TABLE "consignment_agreement"
      ADD CONSTRAINT "consignment_agreement_recorded_by_user_id_fkey"
      FOREIGN KEY ("recorded_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consignment_agreement_signed_document_id_fkey') THEN
    ALTER TABLE "consignment_agreement"
      ADD CONSTRAINT "consignment_agreement_signed_document_id_fkey"
      FOREIGN KEY ("signed_document_id") REFERENCES "upload_object"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consignment_agreement_replaces_agreement_id_fkey') THEN
    ALTER TABLE "consignment_agreement"
      ADD CONSTRAINT "consignment_agreement_replaces_agreement_id_fkey"
      FOREIGN KEY ("replaces_agreement_id") REFERENCES "consignment_agreement"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consignment_agreement_source_ck') THEN
    ALTER TABLE "consignment_agreement"
      ADD CONSTRAINT "consignment_agreement_source_ck" CHECK (
        ("source" = 'online'
          AND "signed_document_id" IS NULL AND "record_reason" IS NULL
          AND "replaces_agreement_id" IS NULL)
        OR ("source" = 'recorded'
          AND "signed_document_id" IS NOT NULL AND "record_reason" IS NOT NULL
          AND "record_reason" <> '')
      );
  END IF;
END $$;
--> statement-breakpoint
-- The Bid company's own finance settings, one row per setting. The first says whether commission
-- carries VAT. Absent means "not set", which holds seller payouts rather than guessing. It starts
-- as standard-rated VAT, the answer the rule assumes while the company is VAT-registered.
CREATE TABLE IF NOT EXISTS "bid_finance_setting" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" text,
  CONSTRAINT "bid_finance_setting_value_ck" CHECK (
    "key" <> 'commission_vat_treatment' OR "value" IN ('standard', 'not_registered')
  ),
  CONSTRAINT "bid_finance_setting_key_ck" CHECK ("key" IN ('commission_vat_treatment'))
);
--> statement-breakpoint
INSERT INTO "bid_finance_setting" ("key", "value")
VALUES ('commission_vat_treatment', 'standard')
ON CONFLICT ("key") DO NOTHING;
