-- The artwork register keeps Zoho's Unit Price for each record so the offer dialogs can show it
-- beside the LAX price and flag when the two differ. It is information only: the price a piece is
-- sold at is set in LAX. Nullable; the next Zoho sync fills it, nobody is backfilled.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register" ADD COLUMN IF NOT EXISTS "zoho_price" numeric(12, 2);
