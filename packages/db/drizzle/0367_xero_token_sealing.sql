-- Xero OAuth tokens move from plaintext columns to envelope-sealed columns (AES-256-GCM, the same
-- envelope that protects Identity's provider tokens). Additive and rollout-safe: the sealed columns
-- are new and nullable, and the plaintext columns lose NOT NULL so they can be nulled once sealed.
-- Existing rows are untouched here: sealing needs the key, so `pnpm db:backfill-xero-token-sealing
-- --apply` seals them and nulls the plaintext. Until then the application reads the plaintext of a
-- row that has no sealed value; from this release on it never writes plaintext.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "xero_connection" ADD COLUMN IF NOT EXISTS "access_token_sealed" text;
--> statement-breakpoint
ALTER TABLE "xero_connection" ADD COLUMN IF NOT EXISTS "refresh_token_sealed" text;
--> statement-breakpoint
ALTER TABLE "xero_connection" ALTER COLUMN "access_token" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "xero_connection" ALTER COLUMN "refresh_token" DROP NOT NULL;
