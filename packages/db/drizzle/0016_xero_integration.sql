-- Xero OAuth connection (single marketplace org).
CREATE TYPE "public"."payment_external_sync_status" AS ENUM ('pending_sync', 'synced', 'error');

CREATE TABLE "xero_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"tenant_name" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scopes" text,
	"connected_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xero_connection_tenant_id_unique" UNIQUE ("tenant_id")
);

CREATE INDEX "xero_connection_tenant_id_idx" ON "xero_connection" USING btree ("tenant_id");

-- Links local payment to Xero invoice / online checkout URL.
CREATE TABLE "payment_external_ref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" text DEFAULT 'xero' NOT NULL,
	"xero_invoice_id" text,
	"xero_invoice_number" text,
	"xero_contact_id" text,
	"xero_payment_id" text,
	"online_invoice_url" text,
	"sync_status" "payment_external_sync_status" DEFAULT 'pending_sync' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_external_ref_payment_id_unique" UNIQUE ("payment_id"),
	CONSTRAINT "payment_external_ref_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment" ("id") ON DELETE CASCADE
);

CREATE INDEX "payment_external_ref_payment_id_idx" ON "payment_external_ref" USING btree ("payment_id");
CREATE INDEX "payment_external_ref_xero_invoice_id_idx" ON "payment_external_ref" USING btree ("xero_invoice_id");

-- Idempotent webhook processing.
CREATE TABLE "xero_webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"event_key" text NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "xero_webhook_event_event_key_uq" ON "xero_webhook_event" USING btree ("event_key");
CREATE INDEX "xero_webhook_event_tenant_resource_idx" ON "xero_webhook_event" USING btree ("tenant_id", "resource_id");
