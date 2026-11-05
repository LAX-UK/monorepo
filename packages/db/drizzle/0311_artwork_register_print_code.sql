-- Prints are issued as LAX-PRT-... Existing LAX-PRI-... codes stay valid, so the stock code check
-- accepts ORI, PRI and PRT. Widens a CHECK only; existing rows already satisfy it.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register" DROP CONSTRAINT IF EXISTS "artwork_register_stock_code_check";
--> statement-breakpoint
ALTER TABLE "artwork_register" ADD CONSTRAINT "artwork_register_stock_code_check" CHECK (
  "stock_code" ~ '^LAX-(ORI|PRI|PRT)-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-[0-9]{2}-[0-9]{4}$'
  AND (("kind" = 'original') = ("stock_code" LIKE 'LAX-ORI-%'))
);
