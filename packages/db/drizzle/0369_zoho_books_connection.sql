-- Zoho Books connections: one row per Books organisation, holding its OAuth tokens sealed only
-- (AES-256-GCM `v1:` envelope, the same one that protects Xero and Identity tokens). There is no
-- plaintext column, and CHECKs require the sealed columns to hold an envelope, so a raw token cannot
-- be stored. Additive: the running release neither reads nor writes the table. Nothing is seeded;
-- a connection row is created when an organisation is authorised.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zoho_books_connection" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL,
  "refresh_token_sealed" text NOT NULL,
  "access_token_sealed" text,
  "access_token_expires_at" timestamp with time zone,
  "connection_status" text DEFAULT 'healthy' NOT NULL,
  "last_refresh_error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zoho_books_connection_organization_id_unique" UNIQUE ("organization_id"),
  CONSTRAINT "zoho_books_connection_refresh_token_sealed_envelope_chk" CHECK ("refresh_token_sealed" LIKE 'v1:%'),
  CONSTRAINT "zoho_books_connection_access_token_sealed_envelope_chk" CHECK ("access_token_sealed" IS NULL OR "access_token_sealed" LIKE 'v1:%'),
  CONSTRAINT "zoho_books_connection_status_chk" CHECK ("connection_status" IN ('healthy', 'needs_reauth'))
);
