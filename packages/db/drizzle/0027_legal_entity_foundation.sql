-- Migration 0027: Legal Entity Model Foundation 
-- Creates all new tables and columns for the symmetric legal entity model
-- Includes pg_trgm extension for artist alias fuzzy search

-- 1. Extension (first - required for trigram indexes)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Enums
CREATE TYPE "user_kyc_status" AS ENUM ('unverified', 'pending', 'approved', 'rejected');
CREATE TYPE "kyc_verification_status" AS ENUM ('created', 'requires_input', 'processing', 'verified', 'canceled');
CREATE TYPE "legal_entity_kind" AS ENUM ('individual', 'organisation');
CREATE TYPE "legal_entity_subkind" AS ENUM ('artist', 'private_collector', 'gallery', 'dealer', 'estate', 'company', 'charity', 'institution', 'lax_stock', 'other');
CREATE TYPE "legal_entity_status" AS ENUM ('lead', 'docs_requested', 'docs_received', 'under_review', 'connect_pending', 'approved', 'restricted', 'rejected', 'archived');
CREATE TYPE "legal_entity_member_role" AS ENUM ('owner', 'admin', 'consignor', 'finance', 'buyer_agent', 'viewer', 'specialist', 'staff');
CREATE TYPE "artist_kind" AS ENUM ('artist', 'maker', 'brand', 'marque');
CREATE TYPE "artist_status" AS ENUM ('pending', 'approved', 'rejected', 'merged_into');
CREATE TYPE "admin_review_task_kind" AS ENUM ('lot_artist_backfill', 'artist_merge_review', 'legal_entity_kyb_review', 'payout_adjustment_review');
CREATE TYPE "admin_review_task_status" AS ENUM ('pending', 'in_progress', 'resolved', 'rejected');

-- 3. New Tables

-- legal_entity
CREATE TABLE IF NOT EXISTS "legal_entity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "display_name" text NOT NULL,
  "legal_name" text,
  "slug" text UNIQUE,
  "kind" "legal_entity_kind" NOT NULL,
  "subkind" "legal_entity_subkind" NOT NULL,
  "created_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "status" "legal_entity_status" NOT NULL DEFAULT 'lead',
  "status_changed_at" timestamp with time zone,
  "status_changed_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "stripe_connect_account_id" text UNIQUE,
  "stripe_connect_charges_enabled" boolean NOT NULL DEFAULT false,
  "stripe_connect_payouts_enabled" boolean NOT NULL DEFAULT false,
  "stripe_connect_requirements_currently_due" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "xero_contact_id" text,
  "vat_number" text,
  "margin_scheme_eligible" boolean NOT NULL DEFAULT false,
  "is_lax_managed" boolean NOT NULL DEFAULT false,
  "platform_fee_bps" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legal_entity_kind_subkind_coherence" CHECK (("kind" = 'individual' AND "subkind" IN ('artist', 'private_collector')) OR ("kind" = 'organisation' AND "subkind" IN ('gallery', 'dealer', 'estate', 'company', 'charity', 'institution', 'lax_stock', 'other'))),
  CONSTRAINT "legal_entity_lax_managed_gate" CHECK (NOT "is_lax_managed" OR "subkind" = 'lax_stock')
);

-- legal_entity_member
CREATE TABLE IF NOT EXISTS "legal_entity_member" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "role" "legal_entity_member_role" NOT NULL,
  "is_primary_admin" boolean NOT NULL DEFAULT false,
  "invited_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "invited_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "removed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legal_entity_member_primary_admin_role" CHECK (NOT "is_primary_admin" OR "role" IN ('owner', 'admin'))
);

-- legal_entity_address
CREATE TABLE IF NOT EXISTS "legal_entity_address" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE cascade,
  "address_type" text NOT NULL,
  "line1" text NOT NULL,
  "line2" text,
  "city" text NOT NULL,
  "state" text,
  "postal_code" text NOT NULL,
  "country" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- legal_entity_document
CREATE TABLE IF NOT EXISTS "legal_entity_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE cascade,
  "upload_object_id" uuid NOT NULL REFERENCES "upload_object"("id") ON DELETE restrict,
  "kind" text NOT NULL,
  "review_status" text NOT NULL DEFAULT 'pending',
  "reviewed_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "reviewed_at" timestamp with time zone,
  "review_notes" text,
  "uploaded_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- legal_entity_payout_method
CREATE TABLE IF NOT EXISTS "legal_entity_payout_method" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE cascade,
  "provider" text NOT NULL DEFAULT 'stripe_connect',
  "stripe_external_account_id" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "retired_at" timestamp with time zone
);

-- payout
CREATE TABLE IF NOT EXISTS "payout" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE restrict,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "gross_amount" numeric(18, 2) NOT NULL,
  "platform_fee" numeric(18, 2) NOT NULL,
  "stripe_fee" numeric(18, 2) NOT NULL,
  "net_amount" numeric(18, 2) NOT NULL,
  "currency" text NOT NULL DEFAULT 'GBP',
  "status" text NOT NULL DEFAULT 'scheduled',
  "stripe_transfer_id" text UNIQUE,
  "xero_bill_id" text,
  "failure_reason" text,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payout_period_coherence" CHECK ("period_end" > "period_start"),
  CONSTRAINT "payout_accounting_integrity" CHECK ("net_amount" = "gross_amount" - "platform_fee" - "stripe_fee"),
  CONSTRAINT "payout_currency_gbp" CHECK ("currency" = 'GBP')
);

-- payout_line
CREATE TABLE IF NOT EXISTS "payout_line" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payout_id" uuid NOT NULL REFERENCES "payout"("id") ON DELETE cascade,
  "payment_id" uuid REFERENCES "payment"("id") ON DELETE restrict,
  "amount" numeric(18, 2) NOT NULL,
  "kind" text NOT NULL,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE restrict,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payout_line_adjustment_integrity" CHECK (("kind" != 'adjustment') OR ("created_by_user_id" IS NOT NULL AND "note" IS NOT NULL)),
  CONSTRAINT "payout_line_payment_required" CHECK (("kind" = 'adjustment') OR ("payment_id" IS NOT NULL))
);

-- kyc_verification
CREATE TABLE IF NOT EXISTS "kyc_verification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "provider" text NOT NULL DEFAULT 'stripe_identity',
  "stripe_verification_session_id" text NOT NULL UNIQUE,
  "status" "kyc_verification_status" NOT NULL,
  "verified_first_name" text,
  "verified_last_name" text,
  "verified_date_of_birth" date,
  "verified_id_number_last4" text,
  "verified_id_country" text,
  "verified_id_type" text,
  "verified_id_expiry" date,
  "decision_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decision_at" timestamp with time zone
);

-- artist_alias
CREATE TABLE IF NOT EXISTS "artist_alias" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "artist_profile_id" uuid NOT NULL REFERENCES "artist_profile"("id") ON DELETE cascade,
  "alias" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'synonym',
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("artist_profile_id", "alias")
);

-- admin_review_task
CREATE TABLE IF NOT EXISTS "admin_review_task" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" "admin_review_task_kind" NOT NULL,
  "status" "admin_review_task_status" NOT NULL DEFAULT 'pending',
  "target_lot_id" uuid REFERENCES "lot"("id") ON DELETE cascade,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "assigned_to_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "resolved_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "resolved_at" timestamp with time zone,
  "resolution_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. Alter existing tables (add new columns)

-- user: KYC fields and acting context tooltip
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "kyc_status" "user_kyc_status" NOT NULL DEFAULT 'unverified';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "kyc_verified_at" timestamp with time zone;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "date_of_birth" date;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "has_seen_acting_context_tooltip" boolean NOT NULL DEFAULT false;

-- artist_profile: registry fields
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "kind" "artist_kind" NOT NULL DEFAULT 'artist';
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "status" "artist_status" NOT NULL DEFAULT 'pending';
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "merged_into_artist_id" uuid;
-- Add self-referencing FK separately (Drizzle schema avoids circular type issue)
ALTER TABLE "artist_profile" ADD CONSTRAINT "artist_profile_merged_into_fk" 
  FOREIGN KEY ("merged_into_artist_id") REFERENCES "artist_profile"("id") ON DELETE SET NULL;
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "created_by_user_id" text REFERENCES "user"("id") ON DELETE set null;
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" text REFERENCES "user"("id") ON DELETE set null;
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "review_notes" text;
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "owner_legal_entity_id" uuid REFERENCES "legal_entity"("id") ON DELETE set null;
ALTER TABLE "artist_profile" ADD CONSTRAINT "artist_profile_merged_into_integrity" CHECK ("status" != 'merged_into' OR "merged_into_artist_id" IS NOT NULL);

-- lot: legal entity and artist FKs
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "seller_legal_entity_id" uuid REFERENCES "legal_entity"("id") ON DELETE restrict;
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "artist_id" uuid REFERENCES "artist_profile"("id") ON DELETE restrict;
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "artist_review_required" boolean NOT NULL DEFAULT false;
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "buyer_legal_entity_id" uuid REFERENCES "legal_entity"("id") ON DELETE set null;

-- item_submission: legal entity
ALTER TABLE "item_submission" ADD COLUMN IF NOT EXISTS "legal_entity_id" uuid REFERENCES "legal_entity"("id") ON DELETE restrict;

-- payment: symmetric legal entity refs
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "buyer_legal_entity_id" uuid REFERENCES "legal_entity"("id") ON DELETE restrict;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "seller_legal_entity_id" uuid REFERENCES "legal_entity"("id") ON DELETE restrict;

-- bid: acting legal entity
ALTER TABLE "bid" ADD COLUMN IF NOT EXISTS "buyer_legal_entity_id" uuid REFERENCES "legal_entity"("id") ON DELETE restrict;

-- sale: created by legal entity
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "created_by_legal_entity_id" uuid REFERENCES "legal_entity"("id") ON DELETE restrict;

-- user_invitation: entity-scoped invitations
ALTER TABLE "user_invitation" ADD COLUMN IF NOT EXISTS "target_legal_entity_id" uuid REFERENCES "legal_entity"("id") ON DELETE cascade;
ALTER TABLE "user_invitation" ADD COLUMN IF NOT EXISTS "target_legal_entity_member_role" text;

-- domain_events: acting context
ALTER TABLE "domain_events" ADD COLUMN IF NOT EXISTS "acting_legal_entity_id" text;

-- 5. Create indexes

-- legal_entity indexes
CREATE INDEX IF NOT EXISTS "legal_entity_status_idx" ON "legal_entity" ("status");
CREATE INDEX IF NOT EXISTS "legal_entity_kind_subkind_idx" ON "legal_entity" ("kind", "subkind");
CREATE INDEX IF NOT EXISTS "legal_entity_created_by_user_id_idx" ON "legal_entity" ("created_by_user_id");
CREATE INDEX IF NOT EXISTS "legal_entity_stripe_connect_account_id_idx" ON "legal_entity" ("stripe_connect_account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "legal_entity_slug_uidx" ON "legal_entity" ("slug") WHERE "slug" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "legal_entity_is_lax_managed_idx" ON "legal_entity" ("is_lax_managed") WHERE "is_lax_managed" = true;

-- legal_entity_member indexes
CREATE UNIQUE INDEX IF NOT EXISTS "legal_entity_member_active_uidx" ON "legal_entity_member" ("legal_entity_id", "user_id") WHERE "removed_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "legal_entity_member_primary_admin_uidx" ON "legal_entity_member" ("legal_entity_id") WHERE "is_primary_admin" = true AND "removed_at" IS NULL;
CREATE INDEX IF NOT EXISTS "legal_entity_member_user_active_idx" ON "legal_entity_member" ("user_id") WHERE "removed_at" IS NULL;
CREATE INDEX IF NOT EXISTS "legal_entity_member_entity_role_idx" ON "legal_entity_member" ("legal_entity_id", "role") WHERE "removed_at" IS NULL;

-- legal_entity_address indexes
CREATE INDEX IF NOT EXISTS "legal_entity_address_entity_type_idx" ON "legal_entity_address" ("legal_entity_id", "address_type");

-- legal_entity_document indexes
CREATE INDEX IF NOT EXISTS "legal_entity_document_entity_review_status_idx" ON "legal_entity_document" ("legal_entity_id", "review_status");
CREATE INDEX IF NOT EXISTS "legal_entity_document_pending_review_idx" ON "legal_entity_document" ("review_status", "uploaded_at") WHERE "review_status" = 'pending';

-- legal_entity_payout_method indexes
CREATE UNIQUE INDEX IF NOT EXISTS "legal_entity_payout_method_default_uidx" ON "legal_entity_payout_method" ("legal_entity_id") WHERE "is_default" = true AND "status" = 'active';

-- payout indexes
CREATE INDEX IF NOT EXISTS "payout_entity_period_end_idx" ON "payout" ("legal_entity_id", "period_end");
CREATE INDEX IF NOT EXISTS "payout_status_period_end_idx" ON "payout" ("status", "period_end");

-- payout_line indexes
CREATE UNIQUE INDEX IF NOT EXISTS "payout_line_payment_kind_uidx" ON "payout_line" ("payout_id", "payment_id", "kind") WHERE "payment_id" IS NOT NULL;

-- kyc_verification indexes
CREATE INDEX IF NOT EXISTS "kyc_verification_user_id_idx" ON "kyc_verification" ("user_id");
CREATE INDEX IF NOT EXISTS "kyc_verification_status_idx" ON "kyc_verification" ("status");

-- artist_alias indexes
CREATE UNIQUE INDEX IF NOT EXISTS "artist_alias_profile_alias_uidx" ON "artist_alias" ("artist_profile_id", "alias");
CREATE INDEX IF NOT EXISTS "artist_alias_alias_trgm_idx" ON "artist_alias" USING gin ("alias" gin_trgm_ops);

-- admin_review_task indexes
CREATE INDEX IF NOT EXISTS "admin_review_task_kind_status_idx" ON "admin_review_task" ("kind", "status");
CREATE INDEX IF NOT EXISTS "admin_review_task_target_lot_idx" ON "admin_review_task" ("target_lot_id");
CREATE INDEX IF NOT EXISTS "admin_review_task_assigned_to_idx" ON "admin_review_task" ("assigned_to_user_id");
CREATE INDEX IF NOT EXISTS "admin_review_task_pending_created_idx" ON "admin_review_task" ("created_at") WHERE "status" = 'pending';

-- artist_profile indexes (new columns)
CREATE INDEX IF NOT EXISTS "artist_profile_status_idx" ON "artist_profile" ("status");
CREATE INDEX IF NOT EXISTS "artist_profile_kind_status_idx" ON "artist_profile" ("kind", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "artist_profile_merged_into_uidx" ON "artist_profile" ("merged_into_artist_id") WHERE "merged_into_artist_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "artist_profile_owner_legal_entity_id_idx" ON "artist_profile" ("owner_legal_entity_id");

-- lot indexes (new columns)
CREATE INDEX IF NOT EXISTS "lot_seller_legal_entity_id_idx" ON "lot" ("seller_legal_entity_id");
CREATE INDEX IF NOT EXISTS "lot_artist_id_idx" ON "lot" ("artist_id");
CREATE INDEX IF NOT EXISTS "lot_artist_review_required_idx" ON "lot" ("artist_review_required");
CREATE INDEX IF NOT EXISTS "lot_buyer_legal_entity_id_idx" ON "lot" ("buyer_legal_entity_id");

-- item_submission indexes (new columns)
CREATE INDEX IF NOT EXISTS "item_submission_legal_entity_id_idx" ON "item_submission" ("legal_entity_id");

-- payment indexes (new columns)
CREATE INDEX IF NOT EXISTS "payment_buyer_legal_entity_id_idx" ON "payment" ("buyer_legal_entity_id");
CREATE INDEX IF NOT EXISTS "payment_seller_legal_entity_id_idx" ON "payment" ("seller_legal_entity_id");

-- bid indexes (new columns)
CREATE INDEX IF NOT EXISTS "bid_buyer_legal_entity_id_idx" ON "bid" ("buyer_legal_entity_id");

-- sale indexes (new columns)
CREATE INDEX IF NOT EXISTS "sale_created_by_legal_entity_id_idx" ON "sale" ("created_by_legal_entity_id");

-- user_invitation indexes (new columns)
CREATE INDEX IF NOT EXISTS "user_invitation_target_legal_entity_idx" ON "user_invitation" ("target_legal_entity_id");

-- domain_events indexes (new columns)
CREATE INDEX IF NOT EXISTS "domain_events_acting_legal_entity_idx" ON "domain_events" ("acting_legal_entity_id", "occurred_at");

-- user indexes (new columns)
CREATE INDEX IF NOT EXISTS "user_kyc_status_idx" ON "user" ("kyc_status");

-- 6. Eager Backfill: Create individual legal_entity for every existing user
-- This runs in the same transaction to ensure atomicity

-- Create legal_entity rows for all existing users (individual entities)
INSERT INTO "legal_entity" (
  "display_name",
  "legal_name",
  "kind",
  "subkind",
  "created_by_user_id",
  "status",
  "status_changed_at",
  "created_at",
  "updated_at"
)
SELECT 
  COALESCE("name", "email") as "display_name",
  NULL as "legal_name",
  'individual' as "kind",
  'private_collector' as "subkind",
  "id" as "created_by_user_id",
  'approved' as "status",
  now() as "status_changed_at",
  "created_at",
  "updated_at"
FROM "user"
ON CONFLICT DO NOTHING;

-- Create legal_entity_member rows (owner + primary_admin for each user's entity)
INSERT INTO "legal_entity_member" (
  "legal_entity_id",
  "user_id",
  "role",
  "is_primary_admin",
  "accepted_at",
  "created_at"
)
SELECT 
  le."id" as "legal_entity_id",
  u."id" as "user_id",
  'owner' as "role",
  true as "is_primary_admin",
  now() as "accepted_at",
  now() as "created_at"
FROM "user" u
JOIN "legal_entity" le ON le."created_by_user_id" = u."id" AND le."kind" = 'individual'
ON CONFLICT DO NOTHING;

-- 7. Backfill legal_entity_id columns on existing tables
-- These reference the user's individual entity created above

-- lot.seller_legal_entity_id
UPDATE "lot" l
SET "seller_legal_entity_id" = le."id"
FROM "legal_entity" le
WHERE le."created_by_user_id" = l."seller_id" AND le."kind" = 'individual'
AND l."seller_legal_entity_id" IS NULL;

-- item_submission.legal_entity_id
UPDATE "item_submission" s
SET "legal_entity_id" = le."id"
FROM "legal_entity" le
WHERE le."created_by_user_id" = s."seller_id" AND le."kind" = 'individual'
AND s."legal_entity_id" IS NULL;

-- payment.buyer_legal_entity_id
UPDATE "payment" p
SET "buyer_legal_entity_id" = le."id"
FROM "legal_entity" le
WHERE le."created_by_user_id" = p."buyer_id" AND le."kind" = 'individual'
AND p."buyer_legal_entity_id" IS NULL;

-- payment.seller_legal_entity_id
UPDATE "payment" p
SET "seller_legal_entity_id" = le."id"
FROM "legal_entity" le
WHERE le."created_by_user_id" = p."seller_id" AND le."kind" = 'individual'
AND p."seller_legal_entity_id" IS NULL;

-- sale.created_by_legal_entity_id
UPDATE "sale" s
SET "created_by_legal_entity_id" = le."id"
FROM "legal_entity" le
WHERE le."created_by_user_id" = s."created_by" AND le."kind" = 'individual'
AND s."created_by_legal_entity_id" IS NULL;

-- bid.buyer_legal_entity_id
UPDATE "bid" b
SET "buyer_legal_entity_id" = le."id"
FROM "legal_entity" le
WHERE le."created_by_user_id" = b."bidder_id" AND le."kind" = 'individual'
AND b."buyer_legal_entity_id" IS NULL;

-- 8. Backfill artist_alias for existing artists
INSERT INTO "artist_alias" ("artist_profile_id", "alias", "kind", "created_at")
SELECT 
  "id" as "artist_profile_id",
  lower("display_name") as "alias",
  'synonym' as "kind",
  now() as "created_at"
FROM "artist_profile"
ON CONFLICT DO NOTHING;
