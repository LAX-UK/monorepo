-- Private sale deals: one work, one seller, one buyer and one agreed price, sold through LAX Bid.
--   private_sale_deal: the deal and its terms (money in pence, GBP only), its stage and deadlines.
--   private_sale_deal_party: the seller and the buyer, one row each, so a side can be shown only
--     what it may see.
--   private_sale_deal_stage_history: one row per stage change, append-only (a trigger refuses
--     changes and deletes).
--   private_sale_deal_document: references to the private sale terms, NDA and other documents,
--     including who accepted which version and when.
-- The work is the item submission; the artwork register id is optional and not a foreign key.
-- A deal with history cannot be deleted, so removal is a retention decision made later.
-- Additive: a sequence and four new tables, so the running services keep working until they restart.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "private_sale_deal_reference_seq" AS bigint MINVALUE 1 START WITH 1;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_sale_deal" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference" text DEFAULT ('PS-' || lpad(nextval('private_sale_deal_reference_seq')::text, 4, '0')) NOT NULL,
  "stage" text DEFAULT 'proposed' NOT NULL,
  "item_submission_id" uuid NOT NULL,
  "artwork_register_id" text,
  "source_enquiry_id" uuid,
  "source_unsold_lot_choice_id" uuid,
  "owner_user_id" text,
  "price_minor" bigint,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "buyer_fee_bps" integer DEFAULT 0 NOT NULL,
  "seller_commission_bps" integer,
  "costs_minor" bigint DEFAULT 0 NOT NULL,
  "vat_treatment" text,
  "parties_disclosed" boolean DEFAULT false NOT NULL,
  "offer_expires_at" timestamp with time zone,
  "payment_due_at" timestamp with time zone,
  "collection_due_at" timestamp with time zone,
  "agreed_at" timestamp with time zone,
  "agreed_by_user_id" text,
  "invoiced_by_user_id" text,
  "cancel_reason" text,
  "cancelled_at" timestamp with time zone,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "private_sale_deal_stage_check" CHECK ("stage" IN ('proposed', 'offer', 'agreed', 'cleared', 'invoiced', 'paid', 'released', 'settled', 'cancelled')),
  CONSTRAINT "private_sale_deal_currency_check" CHECK ("currency" = 'GBP'),
  CONSTRAINT "private_sale_deal_price_check" CHECK ("price_minor" IS NULL OR "price_minor" > 0),
  CONSTRAINT "private_sale_deal_buyer_fee_check" CHECK ("buyer_fee_bps" BETWEEN 0 AND 10000),
  CONSTRAINT "private_sale_deal_commission_check" CHECK ("seller_commission_bps" IS NULL OR "seller_commission_bps" BETWEEN 0 AND 10000),
  CONSTRAINT "private_sale_deal_costs_check" CHECK ("costs_minor" >= 0),
  CONSTRAINT "private_sale_deal_version_check" CHECK ("version" >= 1),
  CONSTRAINT "private_sale_deal_one_source_check" CHECK (num_nonnulls("source_enquiry_id", "source_unsold_lot_choice_id") <= 1),
  CONSTRAINT "private_sale_deal_agreed_price_check" CHECK ("stage" NOT IN ('agreed', 'cleared', 'invoiced', 'paid', 'released', 'settled') OR ("price_minor" IS NOT NULL AND "agreed_at" IS NOT NULL)),
  CONSTRAINT "private_sale_deal_invoiced_check" CHECK ("stage" NOT IN ('invoiced', 'paid', 'released', 'settled') OR ("vat_treatment" IS NOT NULL AND "seller_commission_bps" IS NOT NULL AND "payment_due_at" IS NOT NULL)),
  CONSTRAINT "private_sale_deal_cancelled_check" CHECK (("stage" = 'cancelled') = ("cancel_reason" IS NOT NULL AND "cancelled_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_sale_deal_party" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deal_id" uuid NOT NULL,
  "role" text NOT NULL,
  "legal_entity_id" uuid NOT NULL,
  "acting_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "private_sale_deal_party_role_check" CHECK ("role" IN ('seller', 'buyer'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_sale_deal_stage_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deal_id" uuid NOT NULL,
  "from_stage" text,
  "to_stage" text NOT NULL,
  "actor_user_id" text,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "private_sale_deal_stage_history_stage_check" CHECK ("to_stage" IN ('proposed', 'offer', 'agreed', 'cleared', 'invoiced', 'paid', 'released', 'settled', 'cancelled') AND ("from_stage" IS NULL OR "from_stage" IN ('proposed', 'offer', 'agreed', 'cleared', 'invoiced', 'paid', 'released', 'settled', 'cancelled')))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_sale_deal_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deal_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "audience" text DEFAULT 'staff' NOT NULL,
  "legal_entity_id" uuid,
  "version" text,
  "upload_object_id" uuid,
  "accepted_at" timestamp with time zone,
  "accepted_by_user_id" text,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "private_sale_deal_document_kind_check" CHECK ("kind" IN ('terms', 'nda', 'condition_report', 'provenance', 'invoice', 'other')),
  CONSTRAINT "private_sale_deal_document_audience_check" CHECK ("audience" IN ('staff', 'seller', 'buyer', 'both')),
  CONSTRAINT "private_sale_deal_document_acceptance_check" CHECK ("accepted_at" IS NULL OR ("legal_entity_id" IS NOT NULL AND "version" IS NOT NULL))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal" ADD CONSTRAINT "private_sale_deal_item_submission_id_item_submission_id_fk" FOREIGN KEY ("item_submission_id") REFERENCES "public"."item_submission"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal" ADD CONSTRAINT "private_sale_deal_source_enquiry_id_marketing_enquiry_id_fk" FOREIGN KEY ("source_enquiry_id") REFERENCES "public"."marketing_enquiry"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal" ADD CONSTRAINT "private_sale_deal_source_unsold_lot_choice_id_unsold_lot_choice_id_fk" FOREIGN KEY ("source_unsold_lot_choice_id") REFERENCES "public"."unsold_lot_choice"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal" ADD CONSTRAINT "private_sale_deal_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal" ADD CONSTRAINT "private_sale_deal_agreed_by_user_id_user_id_fk" FOREIGN KEY ("agreed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal" ADD CONSTRAINT "private_sale_deal_invoiced_by_user_id_user_id_fk" FOREIGN KEY ("invoiced_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal_party" ADD CONSTRAINT "private_sale_deal_party_deal_id_private_sale_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."private_sale_deal"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal_party" ADD CONSTRAINT "private_sale_deal_party_legal_entity_id_legal_entity_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal_party" ADD CONSTRAINT "private_sale_deal_party_acting_user_id_user_id_fk" FOREIGN KEY ("acting_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal_stage_history" ADD CONSTRAINT "private_sale_deal_stage_history_deal_id_private_sale_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."private_sale_deal"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- The actor is kept as the history's record of who acted, but a deleted user must not block the
-- delete, so the column is cleared; the trigger below allows exactly that change and no other.
DO $$ BEGIN
  ALTER TABLE "private_sale_deal_stage_history" ADD CONSTRAINT "private_sale_deal_stage_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal_document" ADD CONSTRAINT "private_sale_deal_document_deal_id_private_sale_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."private_sale_deal"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal_document" ADD CONSTRAINT "private_sale_deal_document_legal_entity_id_legal_entity_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal_document" ADD CONSTRAINT "private_sale_deal_document_upload_object_id_upload_object_id_fk" FOREIGN KEY ("upload_object_id") REFERENCES "public"."upload_object"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal_document" ADD CONSTRAINT "private_sale_deal_document_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "private_sale_deal_document" ADD CONSTRAINT "private_sale_deal_document_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_sale_deal_reference_uidx" ON "private_sale_deal" ("reference");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_submission_idx" ON "private_sale_deal" ("item_submission_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_owner_idx" ON "private_sale_deal" ("owner_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_open_idx" ON "private_sale_deal" ("updated_at") WHERE "stage" NOT IN ('settled', 'cancelled');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_sale_deal_party_role_uidx" ON "private_sale_deal_party" ("deal_id", "role");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_party_entity_idx" ON "private_sale_deal_party" ("legal_entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_stage_history_deal_idx" ON "private_sale_deal_stage_history" ("deal_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_document_deal_idx" ON "private_sale_deal_document" ("deal_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_sale_deal_document_acceptance_uidx" ON "private_sale_deal_document" ("deal_id", "legal_entity_id", "kind", "version") WHERE "accepted_at" IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "private_sale_deal_stage_history_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."actor_user_id" IS NULL
     AND OLD."actor_user_id" IS NOT NULL
     AND (NEW."id", NEW."deal_id", NEW."from_stage", NEW."to_stage", NEW."reason", NEW."created_at")
         IS NOT DISTINCT FROM (OLD."id", OLD."deal_id", OLD."from_stage", OLD."to_stage", OLD."reason", OLD."created_at")
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'private_sale_deal_stage_history is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "private_sale_deal_stage_history_guard" ON "private_sale_deal_stage_history";
--> statement-breakpoint
CREATE TRIGGER "private_sale_deal_stage_history_guard"
  BEFORE UPDATE OR DELETE ON "private_sale_deal_stage_history"
  FOR EACH ROW EXECUTE FUNCTION "private_sale_deal_stage_history_guard"();
