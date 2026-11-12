-- A switch for LAX Bid, matching the one LAX Shop keeps for lax.art: when staff turn it on, a
-- lot that is not linked to its Zoho record cannot be published. The table starts empty and an
-- absent switch is off, so nothing changes until staff turn it on. Additive: a new table.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bid_catalogue_setting" (
  "key" text PRIMARY KEY NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text
);
