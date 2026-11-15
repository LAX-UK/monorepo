-- Storage terms for collections (design: docs/design/storage-terms.md). Data only: nothing reads
-- the new tables yet, and nothing is charged.
--
--   collection_storage_terms: versioned per place. A version starts on a date; a cancelled one is
--     kept with its cancelled_at. Rates are pence per lot per day before VAT; a null large rate
--     means the large band is off.
--   collection_place: "raise storage invoices" (off) and the VAT treatment (null until Finance
--     chooses). Charging cannot be on while the treatment is null.
--   lot.storage_large: staff mark works with any side over 150 cm.
--   lot_fulfilment.storage_terms_id: the terms a bought lot was sold under, set when its sale
--     closes. Null for lots won before the first terms: 30 days free, nothing charged.
--   collection_storage_extension / collection_storage_waiver: per-lot decisions, with who and why.
--   collection_storage_audit: every change, with who, when, before, after and why. Append only.
--
-- Data move: a place that has a free_storage_days value gets a first terms version from it
-- (capped at 90 days, the new limit), at a rate of 0 with the large band off, starting on the
-- London day this runs. free_storage_days stays, as running services still read it; the terms
-- replace it in a later release. The unused weekly charge (storage_charge_pence) is dropped.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_storage_terms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL,
  "free_days" smallint NOT NULL,
  "count_mode" text DEFAULT 'calendar' NOT NULL,
  "standard_daily_pence" integer NOT NULL,
  "large_daily_pence" integer,
  "handling_fee_pence" integer DEFAULT 0 NOT NULL,
  "effective_from" date NOT NULL,
  "reason" text NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "cancelled_at" timestamp with time zone,
  CONSTRAINT "collection_storage_terms_free_days_check" CHECK ("free_days" BETWEEN 0 AND 90),
  CONSTRAINT "collection_storage_terms_count_mode_check" CHECK ("count_mode" IN ('calendar', 'working')),
  CONSTRAINT "collection_storage_terms_standard_check" CHECK ("standard_daily_pence" BETWEEN 0 AND 1000000),
  CONSTRAINT "collection_storage_terms_large_check" CHECK ("large_daily_pence" IS NULL OR "large_daily_pence" BETWEEN 0 AND 1000000),
  CONSTRAINT "collection_storage_terms_handling_check" CHECK ("handling_fee_pence" BETWEEN 0 AND 50000),
  CONSTRAINT "collection_storage_terms_reason_check" CHECK (btrim("reason") <> ''),
  CONSTRAINT "collection_storage_terms_venue_id_venue_id_fk"
    FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict,
  CONSTRAINT "collection_storage_terms_created_by_user_id_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
-- One live version per start date at a place.
CREATE UNIQUE INDEX IF NOT EXISTS "collection_storage_terms_start_uidx"
  ON "collection_storage_terms" ("venue_id", "effective_from")
  WHERE "cancelled_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "collection_place"
  ADD COLUMN IF NOT EXISTS "raise_storage_invoices" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "storage_vat_treatment" text;
--> statement-breakpoint
ALTER TABLE "collection_place" DROP CONSTRAINT IF EXISTS "collection_place_storage_vat_check";
--> statement-breakpoint
ALTER TABLE "collection_place" ADD CONSTRAINT "collection_place_storage_vat_check"
  CHECK ("storage_vat_treatment" IS NULL OR "storage_vat_treatment" IN ('standard_rated', 'zero_rated', 'exempt', 'outside_scope'));
--> statement-breakpoint
ALTER TABLE "collection_place" DROP CONSTRAINT IF EXISTS "collection_place_charging_needs_vat_check";
--> statement-breakpoint
ALTER TABLE "collection_place" ADD CONSTRAINT "collection_place_charging_needs_vat_check"
  CHECK (NOT "raise_storage_invoices" OR "storage_vat_treatment" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "storage_large" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "lot_fulfilment" ADD COLUMN IF NOT EXISTS "storage_terms_id" uuid;
--> statement-breakpoint
ALTER TABLE "lot_fulfilment" DROP CONSTRAINT IF EXISTS "lot_fulfilment_storage_terms_id_fk";
--> statement-breakpoint
ALTER TABLE "lot_fulfilment" ADD CONSTRAINT "lot_fulfilment_storage_terms_id_fk"
  FOREIGN KEY ("storage_terms_id") REFERENCES "public"."collection_storage_terms"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lot_fulfilment_storage_terms_idx"
  ON "lot_fulfilment" ("storage_terms_id") WHERE "storage_terms_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_storage_extension" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL,
  "days" smallint NOT NULL,
  "reason" text NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "collection_storage_extension_days_check" CHECK ("days" BETWEEN 1 AND 30),
  CONSTRAINT "collection_storage_extension_reason_check" CHECK (btrim("reason") <> ''),
  CONSTRAINT "collection_storage_extension_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE restrict,
  CONSTRAINT "collection_storage_extension_created_by_user_id_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_storage_extension_lot_idx"
  ON "collection_storage_extension" ("lot_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_storage_waiver" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "collection_storage_waiver_reason_check" CHECK (btrim("reason") <> ''),
  CONSTRAINT "collection_storage_waiver_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE restrict,
  CONSTRAINT "collection_storage_waiver_created_by_user_id_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
-- A lot is waived once.
CREATE UNIQUE INDEX IF NOT EXISTS "collection_storage_waiver_lot_uidx"
  ON "collection_storage_waiver" ("lot_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_storage_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL,
  "lot_id" uuid,
  "action" text NOT NULL,
  "actor_user_id" text,
  "before" jsonb,
  "after" jsonb,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "collection_storage_audit_action_check" CHECK ("action" IN (
    'terms_scheduled', 'terms_edited', 'terms_cancelled',
    'charging_switched', 'vat_treatment_set',
    'large_flag_set', 'extension_granted', 'waiver_granted'
  )),
  CONSTRAINT "collection_storage_audit_venue_id_venue_id_fk"
    FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict,
  CONSTRAINT "collection_storage_audit_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE restrict,
  CONSTRAINT "collection_storage_audit_actor_user_id_user_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_storage_audit_venue_idx"
  ON "collection_storage_audit" ("venue_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_storage_audit_lot_idx"
  ON "collection_storage_audit" ("lot_id", "created_at" DESC) WHERE "lot_id" IS NOT NULL;
--> statement-breakpoint
-- The data move. Re-running adds nothing for a place that already has a version.
INSERT INTO "collection_storage_terms"
  ("venue_id", "free_days", "standard_daily_pence", "effective_from", "reason")
SELECT p."venue_id", LEAST(p."free_storage_days", 90), 0,
       (now() AT TIME ZONE 'Europe/London')::date,
       'Moved from the free storage days setting in Hours and rules'
FROM "collection_place" p
WHERE p."free_storage_days" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "collection_storage_terms" t WHERE t."venue_id" = p."venue_id");
--> statement-breakpoint
ALTER TABLE "collection_place" DROP CONSTRAINT IF EXISTS "collection_place_storage_charge_check";
--> statement-breakpoint
ALTER TABLE "collection_place" DROP COLUMN IF EXISTS "storage_charge_pence";
