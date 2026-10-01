CREATE TYPE "shop_party_kind" AS ENUM('person', 'artist', 'lax', 'gallery', 'broker', 'marketplace');
--> statement-breakpoint
CREATE TYPE "shop_staff_role" AS ENUM(
  'shop_admin',
  'account_manager',
  'broker',
  'operations',
  'finance',
  'catalogue_editor'
);
--> statement-breakpoint
ALTER TABLE "shop_party"
  ADD COLUMN IF NOT EXISTS "kind" "shop_party_kind" DEFAULT 'person' NOT NULL,
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
--> statement-breakpoint
UPDATE "shop_party" SET "kind" = 'lax' WHERE "display_name" = 'LAX London Art Exchange';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_party_single_lax_uid" ON "shop_party" ("kind") WHERE "kind" = 'lax';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_edition_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "shop_edition"("id") ON DELETE restrict,
  "kind" text NOT NULL,
  "from_value" text,
  "to_value" text NOT NULL,
  "actor_subject_id" text,
  "order_id" uuid REFERENCES "shop_order"("id") ON DELETE set null,
  "hold_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_edition_event_edition_idx" ON "shop_edition_event" ("edition_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_staff_member" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_subject_id" text NOT NULL,
  "role" "shop_staff_role" NOT NULL,
  "disabled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_staff_member_subject_uid" ON "shop_staff_member" ("identity_subject_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_admin_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_subject_id" text NOT NULL,
  "capability" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "before_json" text,
  "after_json" text,
  "request_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_admin_audit_created_idx" ON "shop_admin_audit" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_admin_idempotency" (
  "idempotency_key" text NOT NULL,
  "actor_subject_id" text NOT NULL,
  "response_status" integer NOT NULL,
  "response_body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_admin_idempotency_pk" PRIMARY KEY ("idempotency_key", "actor_subject_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_party_invite" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_subject_id" text,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_party_invite_token_hash_uid" ON "shop_party_invite" ("token_hash");
